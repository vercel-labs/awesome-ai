import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import { summarizeMessages } from "@/agents/lib/context"
import {
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import { prompt } from "@/prompts/figma-agent"
import { createEditTool } from "@/tools/edit"
import { createFigmaFetchTool, setProjectDir } from "@/tools/figma/fetch"
import {
	migrationComplete,
	migrationNext,
	migrationProgress,
	migrationSkip,
	migrationStart,
} from "@/tools/figma/migration-state"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { readTool } from "@/tools/read"
import { createWriteTool } from "@/tools/write"

export interface AgentSettings {
	model: LanguageModel
	cwd?: string
	environment?: EnvironmentOptions
	figmaToken?: string
}

export async function createAgent({
	model,
	cwd,
	environment,
	figmaToken,
}: AgentSettings) {
	const env = await getEnvironmentContext({ cwd, ...environment })
	const instructions = prompt(env)

	// Set the project directory for Figma tools to use for persistence
	if (cwd) {
		setProjectDir(cwd)
	}

	const tools = {
		// Figma tools
		figmaFetch: createFigmaFetchTool(figmaToken),
		migrationProgress,
		migrationNext,
		migrationStart,
		migrationComplete,
		migrationSkip,

		// File system tools
		read: readTool,
		write: createWriteTool(),
		edit: createEditTool(),
		list: listTool,
		glob: globTool,
		grep: grepTool,
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
					budgetTokens: 16000,
				},
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
