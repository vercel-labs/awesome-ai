/**
 * Read-only agent that explores, analyzes, and explains codebases without modifying any files.
 */
import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import {
	createContextSummarizer,
	stopOnTextResponse,
} from "@/agents/lib/step-utils"
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

	return new Agent({
		model,
		instructions,
		tools: {
			read: readTool,
			list: listTool,
			grep: grepTool,
			glob: globTool,
			todoRead,
			todoWrite,
		},
		prepareStep: createContextSummarizer(model),
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
