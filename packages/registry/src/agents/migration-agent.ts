/**
 * Executes code migrations by implementing changes from a migration plan in a phased, verified approach.
 * @category migration
 * @category write
 */
import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import {
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import { FULL_BASH_PERMISSIONS } from "@/agents/lib/permissions"
import {
	createContextSummarizer,
	stopOnTextResponse,
} from "@/agents/lib/step-utils"
import { prompt } from "@/prompts/migration-agent"
import { createBashTool } from "@/tools/bash"
import { createEditTool } from "@/tools/edit"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { readTool } from "@/tools/read"
import { createTodoTools, type TodoStorage } from "@/tools/todo"
import { createWriteTool } from "@/tools/write"

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
			write: createWriteTool(),
			edit: createEditTool(),
			bash: createBashTool(FULL_BASH_PERMISSIONS),
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
