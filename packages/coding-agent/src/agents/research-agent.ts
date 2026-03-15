/**
 * Read-only agent that explores, analyzes, and explains codebases without modifying any files.
 * @category research
 * @category read-only
 * @context coding
 */

import {
	applyEnvironment,
	createContextSummarizer,
	createTodoTools,
	type EnvironmentOptions,
	getEnvironmentContext,
	globTool,
	grepTool,
	listTool,
	readTool,
	stopOnTextResponse,
	type TodoStorage,
} from "@awesome-ai/core"
import { type LanguageModel, ToolLoopAgent } from "ai"
import { prompt } from "../prompts/research-agent"

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

	return new ToolLoopAgent({
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
