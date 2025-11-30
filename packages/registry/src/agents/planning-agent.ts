import { Experimental_Agent as Agent, type LanguageModel } from "ai"
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

/**
 * Bash permissions for the planning agent.
 * Read-only: all read commands allowed, everything else denied.
 */
const BASH_PERMISSIONS: Record<string, Permission> = {
	...FILE_READ_COMMANDS,
	...SEARCH_COMMANDS,
	...TEXT_PROCESSING_COMMANDS,
	...GIT_READ_COMMANDS,
	"*": "deny",
}

export interface AgentSettings {
	model: LanguageModel
	workingDirectory?: string
	platform?: string
	date?: string
}

export function createAgent({
	model,
	workingDirectory,
	platform,
	date,
}: AgentSettings) {
	const instructions = getSystemPrompt({
		workingDirectory,
		platform,
		date,
	})

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
