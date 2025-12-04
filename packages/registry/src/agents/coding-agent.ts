import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import { summarizeMessages } from "@/agents/lib/context"
import {
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import {
	DANGEROUS_COMMANDS,
	FILE_READ_COMMANDS,
	GIT_READ_COMMANDS,
	type Permission,
	SEARCH_COMMANDS,
	TEXT_PROCESSING_COMMANDS,
} from "@/agents/lib/permissions"
import { prompt } from "@/prompts/coding-agent"
import { createBashTool } from "@/tools/bash"
import { createEditTool } from "@/tools/edit"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { readTool } from "@/tools/read"
import { createTodoTools, type TodoStorage } from "@/tools/todo"
import { createWriteTool } from "@/tools/write"

const BASH_PERMISSIONS: Record<string, Permission> = {
	...FILE_READ_COMMANDS,
	...SEARCH_COMMANDS,
	...TEXT_PROCESSING_COMMANDS,
	...GIT_READ_COMMANDS,
	...DANGEROUS_COMMANDS,
	"*": "ask",
}

export interface AgentSettings {
	model: LanguageModel
	cwd?: string
	environment?: EnvironmentOptions
	todoStorage?: TodoStorage
}

export async function createAgent({
	model,
	cwd,
	environment,
	todoStorage,
}: AgentSettings) {
	const env = await getEnvironmentContext({ cwd, ...environment })
	const instructions = prompt(env)
	const { todoRead, todoWrite } = createTodoTools(todoStorage)
	const tools = {
		read: readTool,
		write: createWriteTool(),
		edit: createEditTool(),
		bash: createBashTool(BASH_PERMISSIONS),
		list: listTool,
		grep: grepTool,
		glob: globTool,
		todoRead,
		todoWrite,
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
			anthropic: {
				thinking: {
					type: "enabled",
					budgetTokens: 10000,
				},
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
