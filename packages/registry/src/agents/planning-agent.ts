import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import { summarizeMessages } from "@/agents/lib/context"
import {
	type EnvironmentContext,
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import {
	FILE_READ_COMMANDS,
	GIT_READ_COMMANDS,
	type Permission,
	SEARCH_COMMANDS,
	TEXT_PROCESSING_COMMANDS,
} from "@/agents/lib/permissions"
import { getSystemPrompt } from "@/prompts/planning-agent"
import { createBashTool } from "@/tools/bash"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { readTool } from "@/tools/read"

const BASH_PERMISSIONS: Record<string, Permission> = {
	...FILE_READ_COMMANDS,
	...SEARCH_COMMANDS,
	...TEXT_PROCESSING_COMMANDS,
	...GIT_READ_COMMANDS,
	"*": "deny",
}

export interface AgentSettings {
	model: LanguageModel
	cwd?: string
	environment?: EnvironmentOptions
}

export async function createAgent({ model, cwd, environment }: AgentSettings) {
	const env: EnvironmentContext = await getEnvironmentContext({
		cwd,
		...environment,
	})
	const instructions = getSystemPrompt(env)
	// Read-only tools only - no write or edit
	const tools = {
		read: readTool,
		bash: createBashTool(BASH_PERMISSIONS),
		list: listTool,
		grep: grepTool,
		glob: globTool,
	}

	const agent = new Agent({
		model,
		instructions,
		tools,
		async prepareStep({ steps, messages }) {
			const threshold = 200_000
			const lastStep = steps.at(-1)
			const inputTokens = lastStep?.usage?.inputTokens

			if (!inputTokens || inputTokens < threshold) {
				return {}
			}

			const summarized = await summarizeMessages(messages, model, {
				threshold,
				keepRecent: 8,
				protectTokens: 40_000,
			})
			return summarized ? { messages: summarized } : {}
		},
		providerOptions: {
			openai: {
				reasoningEffort: "medium",
				reasoningSummary: "detailed",
			},
		},
		stopWhen: ({ steps }) => {
			if (steps.length === 0) return false

			const lastStep = steps[steps.length - 1]
			if (!lastStep) return false

			// Continue if last step had tool calls (agent is still working)
			if (lastStep.toolCalls && lastStep.toolCalls.length > 0) {
				return false
			}

			// Default: Agent generated text, so stop.
			return true
		},
	})

	return agent
}
