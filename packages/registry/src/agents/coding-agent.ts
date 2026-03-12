/**
 * General-purpose coding agent that helps with software engineering tasks including writing, editing, debugging, and reviewing code.
 * @category coding
 * @category write
 * @context coding
 */
import { type LanguageModel, type ModelMessage, ToolLoopAgent } from "ai"
import type { CacheStorage } from "@/agents/lib/cache-storage"
import {
	applyEnvironment,
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import {
	type AgentGovernanceConfig,
	DEFAULT_TASK_PERMISSIONS,
	FULL_BASH_PERMISSIONS,
	mergePermissionPatterns,
	type SupportedSubagentType,
} from "@/agents/lib/permissions"
import {
	type ContextCompactionOptions,
	createContextSummarizer,
	stopOnTextResponse,
} from "@/agents/lib/step-utils"
import { createAgent as createPlanningAgent } from "@/agents/planning-agent"
import { createAgent as createResearchAgent } from "@/agents/research-agent"
import { prompt } from "@/prompts/coding-agent"
import { createBashTool } from "@/tools/bash"
import { createApplyPatchTool } from "@/tools/apply-patch"
import { createEditTool } from "@/tools/edit"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { createReadTool } from "@/tools/read"
import {
	createSubagentLifecycleTools,
	type RuntimeAgent,
	type RuntimeEvent,
	SubagentRuntime,
} from "@/tools/subagent-lifecycle"
import { createTodoTools, type TodoStorage } from "@/tools/todo"
import { createWriteTool } from "@/tools/write"

const CODING_AGENT_COMPACTION: ContextCompactionOptions = {
	thresholdTokens: 180_000,
	proactiveBufferTokens: 25_000,
	keepRecent: 8,
	protectTokens: 40_000,
	minimumPruneTokens: 20_000,
}

interface CodingToolScope {
	allow: string[]
}

type ToolMode = "patch" | "edit"

interface ModeRule {
	include: string
	exclude?: string[]
}

const TOOL_MODE_RULES: Record<ToolMode, ModeRule[]> = {
	patch: [{ include: "gpt-", exclude: ["oss", "gpt-4"] }],
	edit: [],
}

function resolveModelId(model: LanguageModel, modelId?: string): string {
	if (modelId) return modelId
	const raw = model as Record<string, unknown>
	const direct = raw["modelId"]
	if (typeof direct === "string") return direct
	const nested = raw["model"]
	if (
		nested &&
		typeof nested === "object" &&
		typeof (nested as Record<string, unknown>)["id"] === "string"
	) {
		return (nested as Record<string, unknown>)["id"] as string
	}
	return ""
}

function resolveToolMode(
	model: LanguageModel,
	modelId?: string,
	override?: ToolMode,
): ToolMode {
	if (override) return override
	const id = resolveModelId(model, modelId)
	if (!id) return "edit"
	for (const rule of TOOL_MODE_RULES.patch) {
		if (!id.includes(rule.include)) continue
		if (rule.exclude?.some((x) => id.includes(x))) continue
		return "patch"
	}
	return "edit"
}

interface SubagentGovernanceSettings extends AgentGovernanceConfig {
	childToolScopes?: {
		"coding-agent"?: CodingToolScope
	}
	allowedSubagentTypes?: SupportedSubagentType[]
}

const DEFAULT_CODING_CHILD_TOOL_SCOPE: CodingToolScope = {
	allow: [
		"read",
		"write",
		"edit",
		"apply_patch",
		"bash",
		"list",
		"grep",
		"glob",
		"todoRead",
		"todoWrite",
		"sendInput",
		"waitForSubagents",
		"interruptSubagent",
		"resumeSubagent",
		"closeSubagent",
	],
}

const DEFAULT_ALLOWED_SUBAGENT_TYPES: SupportedSubagentType[] = [
	"coding-agent",
	"planning-agent",
	"research-agent",
]

function asRuntimeAgent(agent: any): RuntimeAgent {
	return {
		async stream(input) {
			const result = await agent.stream(input)
			const response = await Promise.resolve(result.response)
			return {
				response: Promise.resolve({ messages: response.messages }),
			}
		},
	}
}

export interface AgentSettings {
	model: LanguageModel
	modelId?: string
	toolMode?: ToolMode
	cwd?: string
	environment?: EnvironmentOptions
	todoStorage?: TodoStorage
	subagentRuntime?: SubagentRuntime
	subagentAgentId?: string
	maxSubagentDepth?: number
	maxSubagentThreads?: number
	cacheStorage?: CacheStorage
	subagentGovernance?: SubagentGovernanceSettings
	toolScope?: CodingToolScope
	onSubagentStatus?: (event: RuntimeEvent) => void
	getSubagentParentMessages?: () => ModelMessage[]
}

async function createCodingAgent({
	model,
	modelId,
	toolMode,
	cwd,
	environment,
	todoStorage,
	subagentRuntime,
	subagentAgentId,
	maxSubagentDepth,
	maxSubagentThreads,
	cacheStorage,
	subagentGovernance,
	toolScope,
	onSubagentStatus,
	getSubagentParentMessages,
}: AgentSettings) {
	const env = await getEnvironmentContext({ cwd, ...environment })
	const instructions = applyEnvironment(prompt, env)
	const { todoRead, todoWrite } = createTodoTools(todoStorage)
	const mergedTaskPermissions = mergePermissionPatterns(
		DEFAULT_TASK_PERMISSIONS,
		subagentGovernance?.taskPermissions,
	)
	const allowedSubagentTypes =
		subagentGovernance?.allowedSubagentTypes ?? DEFAULT_ALLOWED_SUBAGENT_TYPES
	const childToolScope =
		subagentGovernance?.childToolScopes?.["coding-agent"] ??
		DEFAULT_CODING_CHILD_TOOL_SCOPE
	let runtime: SubagentRuntime
	if (subagentRuntime) {
		runtime = subagentRuntime
	} else {
		runtime = new SubagentRuntime({
			model,
			maxDepth: maxSubagentDepth,
			maxThreads: maxSubagentThreads,
			onStatus: onSubagentStatus,
			cacheStorage,
			resolveAgent: async ({
				type,
				model: childModel,
				agentId,
			}): Promise<RuntimeAgent> => {
				if (type === "coding-agent") {
					if (childToolScope.allow.length === 0) {
						throw new Error(`Child tool scope for "${type}" cannot be empty.`)
					}
					const childAgent = await createCodingAgent({
						model: childModel,
						modelId,
						toolMode,
						cwd,
						environment,
						todoStorage,
						subagentRuntime: runtime,
						subagentAgentId: agentId,
						maxSubagentDepth,
						maxSubagentThreads,
						cacheStorage,
						subagentGovernance,
						toolScope: childToolScope,
						onSubagentStatus,
					})
					return asRuntimeAgent(childAgent)
				}
				if (type === "planning-agent") {
					const childAgent = await createPlanningAgent({
						model: childModel,
						cwd,
						environment,
						todoStorage,
					})
					return asRuntimeAgent(childAgent)
				}
				if (type === "research-agent") {
					const childAgent = await createResearchAgent({
						model: childModel,
						cwd,
						environment,
						todoStorage,
					})
					return asRuntimeAgent(childAgent)
				}
				throw new Error(
					`Unsupported subagent type: ${type}. Supported types: coding-agent, planning-agent, research-agent.`,
				)
			},
		})
	}
	const subagentTools = createSubagentLifecycleTools({
		runtime,
		currentAgentId: subagentAgentId,
		getParentMessages: getSubagentParentMessages,
		taskPermissions: mergedTaskPermissions,
		allowedSubagentTypes,
	})
	const scope = subagentAgentId ?? `root-${Math.random().toString(36).slice(2)}`

	const allTools = {
		read: createReadTool(scope),
		write: createWriteTool("ask", { scope }),
		edit: createEditTool("ask", { scope }),
		apply_patch: createApplyPatchTool(),
		bash: createBashTool(FULL_BASH_PERMISSIONS, { safeAutoApprove: true }),
		list: listTool,
		grep: grepTool,
		glob: globTool,
		todoRead,
		todoWrite,
		spawnAgent: subagentTools.spawnAgent,
		sendInput: subagentTools.sendInput,
		waitForSubagents: subagentTools.waitForSubagents,
		interruptSubagent: subagentTools.interruptSubagent,
		resumeSubagent: subagentTools.resumeSubagent,
		closeSubagent: subagentTools.closeSubagent,
	}
	const selectedTools = (() => {
		const mode = resolveToolMode(model, modelId, toolMode)
		if (mode !== "patch") {
			const { apply_patch: _apply, ...rest } = allTools
			return rest
		}
		const { edit: _edit, write: _write, ...rest } = allTools
		return rest
	})()
	const scopedTools = (() => {
		const tools = selectedTools as Record<string, unknown>
		if (!toolScope) {
			return tools
		}
		const knownSet = new Set(Object.keys(tools))
		const invalid = toolScope.allow.filter((name) => !knownSet.has(name))
		if (invalid.length > 0) {
			throw new Error(`Unknown toolScope entries: ${invalid.join(", ")}`)
		}
		const selected: Record<string, unknown> = {}
		for (const name of toolScope.allow) {
			selected[name] = tools[name]
		}
		return selected
	})()

	return new ToolLoopAgent({
		model,
		instructions,
		tools: scopedTools as any,
		prepareStep: createContextSummarizer(model, CODING_AGENT_COMPACTION),
		providerOptions: {
			openai: {
				reasoningEffort: "medium",
				reasoningSummary: "detailed",
			},
			anthropic: {
				thinking: {
					type: "enabled",
					budgetTokens: 10000,
				},
			},
		},
		stopWhen: stopOnTextResponse,
	})
}

export async function createAgent(settings: AgentSettings) {
	return createCodingAgent(settings)
}
