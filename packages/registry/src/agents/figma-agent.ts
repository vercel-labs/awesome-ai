/**
 * Converts Figma designs into pixel-perfect code using Next.js, Tailwind CSS, and TypeScript.
 * @category design
 * @category write
 * @config figmaToken string? - Figma API access token for fetching designs
 * @config figmaToken env FIGMA_ACCESS_TOKEN
 */
import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import {
	type EnvironmentOptions,
	getEnvironmentContext,
} from "@/agents/lib/environment"
import {
	createContextSummarizer,
	stopOnTextResponse,
} from "@/agents/lib/step-utils"
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

	if (cwd) {
		setProjectDir(cwd)
	}

	return new Agent({
		model,
		instructions,
		tools: {
			figmaFetch: createFigmaFetchTool(figmaToken),
			migrationProgress,
			migrationNext,
			migrationStart,
			migrationComplete,
			migrationSkip,
			read: readTool,
			write: createWriteTool(),
			edit: createEditTool(),
			list: listTool,
			glob: globTool,
			grep: grepTool,
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
					budgetTokens: 16000,
				},
			},
		},
		stopWhen: stopOnTextResponse,
	})
}
