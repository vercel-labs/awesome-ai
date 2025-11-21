#!/usr/bin/env bun

import * as readline from "node:readline"
import { gateway } from "@ai-sdk/gateway"
import type { ModelMessage, ToolApprovalResponse, UIMessage } from "ai"
import { convertToModelMessages } from "ai"
import { createAgent, FileStorage, generateId } from "coding-agent"

// Helper function to convert ModelMessage to UIMessage for storage
// Note: Tool messages are not converted as they're part of assistant message parts in UIMessage
function modelMessageToUIMessage(message: ModelMessage): UIMessage | null {
	if (message.role === "tool") return null
	return { ...message, id: generateId(), parts: [] }
}

// Parse command line args
const args = process.argv.slice(2)
let chatId: string | undefined
let initialPrompt = ""

// Check if first arg is --chat-id
if (args[0] === "--chat-id" && args[1]) {
	chatId = args[1]
	initialPrompt = args.slice(2).join(" ")
} else {
	initialPrompt = args.join(" ")
}

// Create readline interface for interactive prompts
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

function prompt(question: string): Promise<string> {
	return new Promise((resolve) => {
		rl.question(question, resolve)
	})
}

async function promptForApproval(
	toolName: string,
	input: any,
): Promise<{ approved: boolean; reason?: string }> {
	console.log(`\n!  Tool requires approval: ${toolName}`)
	console.log("Input:", JSON.stringify(input, null, 2))

	const response = await prompt("Approve? (y/n/reason): ")
	const lowerResponse = response.toLowerCase().trim()

	if (lowerResponse === "y" || lowerResponse === "yes") {
		return { approved: true }
	}
	if (lowerResponse === "n" || lowerResponse === "no") {
		return { approved: false }
	}
	// Any other text is treated as denial with reason
	return { approved: false, reason: response }
}

const db = new FileStorage({
	baseDir: ".agent-cli-storage",
})
const agent = createAgent({
	// model: gateway("openai/gpt-5"),
	model: gateway("anthropic/claude-sonnet-4.5"),
	debug: true,
})

async function main() {
	console.log("🤖 Agent CLI")
	console.log("============\n")

	// Conversation state management
	let conversationMessages: ModelMessage[] = []

	// Load existing chat if chatId was provided
	if (chatId) {
		try {
			const storedMessages = await db.getMessages(chatId)
			// Convert UIMessage back to ModelMessage for the agent
			conversationMessages = convertToModelMessages(storedMessages, {
				tools: agent.tools,
			})
			console.log(`📂 Loaded chat: ${chatId}`)
			console.log(`📝 ${conversationMessages.length} message(s) loaded\n`)
		} catch (error) {
			console.error(
				`❌ Failed to load chat ${chatId}:`,
				error instanceof Error ? error.message : String(error),
			)
			console.log("Starting new chat instead...\n")
			conversationMessages = []
			chatId = undefined
		}
	}

	// Start with initial prompt if provided
	let userPrompt = initialPrompt

	if (!userPrompt) {
		userPrompt = await prompt("You: ")
	} else {
		console.log(`You: ${userPrompt}\n`)
	}

	// Main conversation loop
	while (
		userPrompt.toLowerCase() !== "exit" &&
		userPrompt.toLowerCase() !== "quit"
	) {
		try {
			// Run agent with conversation context
			await runAgentWithApprovals(userPrompt, conversationMessages)

			// Get next prompt
			userPrompt = await prompt("You: ")
		} catch (error) {
			console.error(
				"\n❌ Error:",
				error instanceof Error ? error.message : String(error),
			)
			console.log("")

			// Ask if user wants to continue
			const continuePrompt = await prompt("Continue? (y/n): ")
			if (continuePrompt.toLowerCase() !== "y") {
				break
			}

			userPrompt = await prompt("You: ")
		}
	}

	console.log("\n👋 Goodbye!")
	rl.close()
}

async function runAgentWithApprovals(
	userPrompt: string,
	conversationMessages: ModelMessage[],
) {
	// Track pending approvals during streaming
	const pendingApprovals = new Map<
		string,
		{
			toolName: string
			toolCallId: string
			input: any
		}
	>()

	console.log("\n💭 Agent is thinking...\n")

	// Add user message to conversation if this is a new prompt (not a resume)
	if (userPrompt) {
		const userMessage: ModelMessage = {
			role: "user",
			content: userPrompt,
		}
		conversationMessages.push(userMessage)

		// Create chat if it doesn't exist yet
		if (!chatId) {
			const chat = await db.createChat()
			chatId = chat.id
			console.log(`💾 Created new chat: ${chatId}\n`)
		}

		// Save user message immediately (convert to UIMessage)
		const uiMessage = modelMessageToUIMessage(userMessage)
		if (uiMessage) {
			await db.saveMessage(chatId, uiMessage)
		}
	}

	// Stream the agent response with conversation messages
	const result = await agent.stream({ messages: conversationMessages })

	let hasTextOutput = false
	let hasReasoningOutput = false

	for await (const chunk of result.fullStream) {
		switch (chunk.type) {
			case "reasoning-start": {
				console.log("\n🧠 Reasoning started\n")
				break
			}

			case "reasoning-delta": {
				if (!hasReasoningOutput) {
					console.log("\n🧠 Reasoning:\n")
					hasReasoningOutput = true
				}
				process.stdout.write(chunk.text)
				break
			}

			case "reasoning-end": {
				if (hasReasoningOutput) {
					console.log("\n") // Add newline after reasoning
				}
				break
			}

			case "text-delta": {
				if (!hasTextOutput) {
					console.log("\nAgent: ")
					hasTextOutput = true
				}
				process.stdout.write(chunk.text)
				break
			}

			case "tool-call": {
				if (chunk.dynamic) continue
				console.log(
					`\n🔧 Calling tool: ${chunk.toolName} with args:`,
					JSON.stringify(chunk.input, null, 2),
				)
				break
			}

			case "tool-approval-request": {
				// Track approval requests
				pendingApprovals.set(chunk.approvalId, {
					toolName: chunk.toolCall.toolName,
					toolCallId: chunk.toolCall.toolCallId,
					input: chunk.toolCall.input,
				})
				break
			}

			case "tool-result": {
				if (chunk.dynamic) continue
				const output = chunk.output as {
					status?: string
					message?: string
					error?: string
				}
				if (!output?.status || !output?.message) break

				if (chunk.preliminary) {
					// Log preliminary results (pending state)
					if (output.status === "pending") {
						console.log(`   ⏳ ${output.message}`)
					}
				} else {
					// Log final result
					if (output.status === "success") {
						console.log(`   ✅ ${output.message}`)
					} else if (output.status === "error") {
						console.log(`   ❌ ${output.message}: ${output.error}`)
					}
				}
				break
			}

			case "error": {
				console.error(`\n❌ Error: ${chunk.error}`)
				break
			}
		}
	}

	// Wait for all steps to complete
	const allSteps = await result.steps
	console.log(`\n\n✨ Completed in ${allSteps.length} step(s)\n`)

	// Update conversation messages with the response
	const response = await result.response

	// Save all assistant messages from the response (convert to UIMessage)
	if (chatId && response.messages.length > 0) {
		const uiMessages = response.messages
			.map((msg) => modelMessageToUIMessage(msg))
			.filter((msg) => msg !== null)

		if (uiMessages.length > 0) {
			await db.saveMessages(chatId, uiMessages)
		}
	}

	conversationMessages.push(...response.messages)

	if (chatId) {
		console.log(`💾 Chat saved: ${chatId}`)
		console.log(
			`   To resume: bun run start --chat-id ${chatId} "your message"\n`,
		)
	}

	// Handle pending approvals if any
	if (pendingApprovals.size > 0) {
		console.log(
			`\n📋 ${pendingApprovals.size} tool(s) require approval before continuing.\n`,
		)

		// Collect approval responses
		const approvalResponses: Array<ToolApprovalResponse> = []

		for (const [approvalId, approval] of pendingApprovals) {
			const response = await promptForApproval(
				approval.toolName,
				approval.input,
			)
			approvalResponses.push({
				type: "tool-approval-response",
				approvalId,
				approved: response.approved,
				reason: response.reason,
			})

			// Log the decision
			if (response.approved) {
				console.log(`✅ Approved ${approval.toolName}`)
			} else {
				console.log(
					`❌ Denied ${approval.toolName}${response.reason ? `: ${response.reason}` : ""}`,
				)
			}
		}

		// Add approval responses to conversation as a tool message
		conversationMessages.push({ role: "tool", content: approvalResponses })

		// Automatically resume the agent with approval responses
		console.log("\n🔄 Resuming agent with approval responses...\n")
		await runAgentWithApprovals("", conversationMessages)
	}
}

// Run the CLI
main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
