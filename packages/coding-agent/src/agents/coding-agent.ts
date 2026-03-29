/**
 * General-purpose coding agent that helps with software engineering tasks including writing, editing, debugging, and reviewing code.
 * @category coding
 * @category write
 * @context coding
 */

import {
	type AgentGovernanceConfig,
	applyEnvironment,
	type CacheStorage,
	type ContextCompactionOptions,
	cleanupReads,
	clearReads,
	createBashTool,
	createContextSummarizer,
	createEditTool,
	createReadTool,
	createTodoTools,
	createWriteTool,
	DEFAULT_TASK_PERMISSIONS,
	type EnvironmentOptions,
	FULL_BASH_PERMISSIONS,
	getEnvironmentContext,
	globTool,
	grepTool,
	listTool,
	mergePermissionPatterns,
	type SupportedSubagentType,
	stopOnTextResponse,
	type TodoStorage,
} from "@awesome-ai/core"
import { type LanguageModel, type ModelMessage, ToolLoopAgent } from "ai"
import { prompt } from "../prompts/coding-agent"
import { createApplyPatchTool } from "../tools/apply-patch"
import {
	createSubagentLifecycleTools,
	type RuntimeAgent,
	type RuntimeEvent,
	SubagentRuntime,
} from "../tools/subagent-lifecycle"
import { resolveToolMode, type ToolMode } from "./lib/tool-mode"
import { createAgent as createPlanningAgent } from "./planning-agent"
import { createAgent as createResearchAgent } from "./research-agent"

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
	cleanupReads()
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
		subagentGovernance?.childToolScopes?.["coding-agent"] ?? DEFAULT_CODING_CHILD_TOOL_SCOPE
	const handleStatus = (event: RuntimeEvent) => {
		const done =
			event.status === "completed" ||
			event.status === "errored" ||
			event.status === "shutdown" ||
			event.status === "interrupted" ||
			event.status === "timeout" ||
			event.status === "not_found"
		if (done) {
			clearReads(event.agentId)
		}
		onSubagentStatus?.(event)
	}
	let runtime: SubagentRuntime
	if (subagentRuntime) {
		runtime = subagentRuntime
	} else {
		runtime = new SubagentRuntime({
			model,
			maxDepth: maxSubagentDepth,
			maxThreads: maxSubagentThreads,
			onStatus: handleStatus,
			cacheStorage,
			resolveAgent: async ({ type, model: childModel, agentId }): Promise<RuntimeAgent> => {
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
						onSubagentStatus: handleStatus,
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
