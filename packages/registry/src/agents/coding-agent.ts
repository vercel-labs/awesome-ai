import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import { type ToolPermissions } from "@/agents/lib/permissions"
import { getSystemPrompt } from "@/prompts/coding-agent"
import { createBashTool } from "@/tools/bash"
import { createEditTool } from "@/tools/edit"
import { globTool } from "@/tools/glob"
import { grepTool } from "@/tools/grep"
import { listTool } from "@/tools/list"
import { readTool } from "@/tools/read"
import { createWriteTool } from "@/tools/write"

export interface AgentSettings {
	model: LanguageModel
	workingDirectory?: string
	platform?: string
	date?: string
	debug?: boolean
	/** Custom permission patterns for tools. */
	permissions?: ToolPermissions
}

export function createAgent({
	model,
	workingDirectory,
	platform,
	date,
	debug,
	permissions,
}: AgentSettings) {
	const instructions = getSystemPrompt({
		workingDirectory,
		platform,
		date,
	})

	const tools = {
		read: readTool,
		write: createWriteTool(permissions?.write),
		edit: createEditTool(permissions?.edit),
		bash: createBashTool(permissions?.bash),
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

			if (debug) {
				console.log(`\n📊 [Debug] Step ${steps.length} completed`)
				if (lastStep.toolCalls && lastStep.toolCalls.length > 0) {
					console.log(
						`   Tool calls: ${lastStep.toolCalls.map((tc) => tc.toolName).join(", ")}`,
					)
					// Log tool results if available
					if (lastStep.toolResults) {
						for (const result of lastStep.toolResults) {
							if (result.dynamic) continue
							const output = result.output as {
								status?: string
								message?: string
							}
							if (output?.message) {
								console.log(`   ${output.message}`)
							}
						}
					}
				}
				if (lastStep.text) {
					console.log(
						`   Generated text: ${lastStep.text.substring(0, 100)}${lastStep.text.length > 100 ? "..." : ""}`,
					)
				}
			}

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
