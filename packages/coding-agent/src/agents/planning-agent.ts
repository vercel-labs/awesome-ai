/**
 * Read-only agent that analyzes code architecture, creates implementation plans, and reviews code for potential issues.
 * @category planning
 * @category read-only
 * @context coding
 */

import {
	applyEnvironment,
	createBashTool,
	createContextSummarizer,
	createTodoTools,
	type EnvironmentOptions,
	getEnvironmentContext,
	globTool,
	grepTool,
	listTool,
	READONLY_BASH_PERMISSIONS,
	readTool,
	stopOnTextResponse,
	type TodoStorage,
} from "@awesome-ai/core"
import { type LanguageModel, ToolLoopAgent } from "ai"
import { prompt } from "../prompts/planning-agent"

export interface AgentSettings {
	model: LanguageModel
	cwd?: string
	environment?: EnvironmentOptions
	todoStorage?: TodoStorage
}

export async function createAgent({ model, cwd, environment, todoStorage }: AgentSettings) {
	const env = await getEnvironmentContext({ cwd, ...environment })
	const instructions = applyEnvironment(prompt, env)
	const { todoRead, todoWrite } = createTodoTools(todoStorage)

	return new ToolLoopAgent({
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
