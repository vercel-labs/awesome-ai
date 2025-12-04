import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import { summarizeMessages } from "@/agents/lib/context"
import {
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import { prompt } from "@/prompts/research-agent"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { readTool } from "@/tools/read"
import { createTodoTools, type TodoStorage } from "@/tools/todo"

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
		},
		stopWhen: ({ steps }) => {
			if (steps.length === 0) return false

			const lastStep = steps[steps.length - 1]
			if (!lastStep) return false

			if (lastStep.toolCalls && lastStep.toolCalls.length > 0) {
				return false
			}

			return true
		},
	})

	return agent
}
