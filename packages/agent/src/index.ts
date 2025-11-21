import { Experimental_Agent as Agent, type LanguageModel } from "ai"
import { getSystemPrompt } from "./prompt"
import { tools } from "./tools"

export interface AgentSettings {
	model: LanguageModel
	workingDirectory?: string
	platform?: string
	date?: string
	debug?: boolean
}

export function createAgent({
	model,
	workingDirectory,
	platform,
	date,
	debug,
}: AgentSettings) {
	const instructions = getSystemPrompt({
		workingDirectory,
		platform,
		date,
	})
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

// Re-export error types
export {
	AbortError,
	AgentError,
	AuthenticationError,
	ConfigurationError,
	calculateBackoff,
	isRetryableError,
	ModelOutputError,
	NetworkError,
	parseAISDKError,
	RateLimitError,
	TimeoutError,
	ValidationError,
} from "./errors"
export { FileStorage, type Message } from "./storage/file-storage"
export { generateId } from "./storage/utils"
// Re-export tools
export {
	bashTool,
	editTool,
	globTool,
	grepTool,
	listTool,
	readTool,
	tools,
	writeTool,
} from "./tools"
