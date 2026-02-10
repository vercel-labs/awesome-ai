/**
 * Read-only agent that analyzes code architecture, creates implementation plans, and reviews code for potential issues.
 * @category planning
 * @category read-only
 * @context coding
 */
import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import {
	applyEnvironment,
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import { READONLY_BASH_PERMISSIONS } from "@/agents/lib/permissions"
import {
	createContextSummarizer,
	stopOnTextResponse,
} from "@/agents/lib/step-utils"
import { prompt } from "@/prompts/planning-agent"
import { createBashTool } from "@/tools/bash"
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
	const instructions = applyEnvironment(prompt, env)
	const { todoRead, todoWrite } = createTodoTools(todoStorage)

	return new Agent({
		model,
		instructions,
		tools: {
			read: readTool,
			bash: createBashTool(READONLY_BASH_PERMISSIONS),
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
