import type { Agent, ModelMessage } from "ai"
import {
	addMessage,
	availableAgentsAtom,
	currentAgentAtom,
	currentChatIdAtom,
	cwdAtom,
	debugLog,
	isLoadingAtom,
	type MessageAtom,
	messagesAtom,
	pendingApprovalsAtom,
	removePendingApproval,
	selectedModelAtom,
} from "../components/atoms"
import type { ToolData } from "../components/tool-part"
import {
	createAssistantMessage,
	createSystemMessage,
	createUserMessage,
	type TUIMessage,
} from "../types"
import { saveWorkspaceSettings } from "./settings"
import { createChat, type StoredChat, saveChat } from "./storage"

// Global state for agent and conversation
let currentAgentInstance: Agent | null = null
let conversationMessages: ModelMessage[] = []
let currentAbortController: AbortController | null = null
let currentStreamingMessageAtom: MessageAtom | null = null
let agentLoadPromise: Promise<boolean> | null = null

export function resetConversation() {
	conversationMessages = []
	currentAgentInstance = null
}

function getMessages(): TUIMessage[] {
	return messagesAtom.get().map((atom) => atom.get())
}

async function saveCurrentChat() {
	const chatId = currentChatIdAtom.get()
	if (!chatId) return

	const messages = getMessages()
	const chat: StoredChat = {
		id: chatId,
		title: "", // Will be set by saveChat based on first user message
		messages,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}
	await saveChat(chat)
}

export async function startNewChat() {
	const chat = await createChat()
	currentChatIdAtom.set(chat.id)
	messagesAtom.set([])
	resetConversation()
	saveWorkspaceSettings({ lastChatId: chat.id })
	return chat
}

export function isAgentLoaded() {
	return currentAgentInstance !== null
}

export function stopGeneration() {
	if (!currentAbortController) return false

	currentAbortController.abort()
	currentAbortController = null

	// Remove streaming flag from current message
	if (currentStreamingMessageAtom) {
		const msg = currentStreamingMessageAtom.get()
		currentStreamingMessageAtom.set({
			...msg,
			metadata: { timestamp: msg.metadata?.timestamp ?? Date.now() },
		})
		currentStreamingMessageAtom = null
	}

	isLoadingAtom.set(false)
	addMessage(createSystemMessage("Generation stopped."))
	return true
}

/**
 * Stream an agent response and update the message atom with the results.
 */
async function streamAgentResponse(messageAtom: MessageAtom): Promise<void> {
	if (!currentAgentInstance) return

	currentAbortController = new AbortController()
	currentStreamingMessageAtom = messageAtom

	try {
		const result = await currentAgentInstance.stream({
			messages: conversationMessages,
			abortSignal: currentAbortController.signal,
		})

		let reasoningText = ""
		let responseText = ""
		let hasReasoningPart = false

		const updateMessage = () => {
			const current = messageAtom.get()
			let parts = current.parts

			// If we have reasoning text but no reasoning part yet, add one
			if (reasoningText && !hasReasoningPart) {
				debugLog("xD Adding reasoning part to message UwU")

				hasReasoningPart = true
				// Insert reasoning part before the text part
				const textPartIndex = parts.findIndex((p) => p.type === "text")
				if (textPartIndex >= 0) {
					parts = [
						...parts.slice(0, textPartIndex),
						{ type: "reasoning" as const, text: reasoningText },
						...parts.slice(textPartIndex),
					]
				} else {
					parts = [
						{ type: "reasoning" as const, text: reasoningText },
						...parts,
					]
				}
			}

			const newParts = parts.map((part) => {
				if (part.type === "text") {
					return { ...part, text: responseText }
				}
				if (part.type === "reasoning") {
					return { ...part, text: reasoningText }
				}
				return part
			})
			messageAtom.set({ ...current, parts: newParts as TUIMessage["parts"] })
		}

		for await (const chunk of result.fullStream) {
			switch (chunk.type) {
				case "reasoning-delta":
					reasoningText += chunk.text
					updateMessage()
					break

				case "text-delta":
					responseText += chunk.text
					updateMessage()
					break

				case "error":
					throw new Error(String(chunk.error))
			}
		}

		// Mark streaming as complete (remove streaming flag)
		const finalMsg = messageAtom.get()
		messageAtom.set({
			...finalMsg,
			metadata: { timestamp: finalMsg.metadata?.timestamp ?? Date.now() },
		})

		const response = await result.response
		conversationMessages.push(...response.messages)

		// Save chat after response completes
		await saveCurrentChat()
	} finally {
		currentAbortController = null
		currentStreamingMessageAtom = null
	}
}

export async function loadAgent(agentName: string): Promise<boolean> {
	const agents = availableAgentsAtom.get()
	const agentInfo = agents.find((a) => a.name === agentName)

	if (!agentInfo) {
		agentLoadPromise = null
		return false
	}

	const loadPromise = (async () => {
		try {
			// Dynamically import the agent module
			const agentModule = await import(agentInfo.path)

			// Agents typically export a createAgent function
			if (typeof agentModule.createAgent === "function") {
				const { gateway } = await import("@ai-sdk/gateway")
				const modelId = selectedModelAtom.get()
				const model = gateway(modelId)

				const agent = await agentModule.createAgent({
					model,
					cwd: cwdAtom.get(),
				})
				currentAgentInstance = agent
				conversationMessages = [] // Reset conversation for new agent
				return true
			}

			// Some agents might export the agent directly
			if (agentModule.default && agentModule.default.version === "agent-v1") {
				currentAgentInstance = agentModule.default
				conversationMessages = []
				return true
			}

			return false
		} catch (error) {
			debugLog(`Failed to load agent ${agentName}:`, error)
			return false
		} finally {
			agentLoadPromise = null
		}
	})()

	agentLoadPromise = loadPromise
	return loadPromise
}

export async function sendMessage(userPrompt: string): Promise<void> {
	// Wait for any in-progress agent loading
	if (agentLoadPromise) {
		await agentLoadPromise
	}

	if (!currentAgentInstance) {
		addMessage(
			createSystemMessage(
				"No agent loaded. Select an agent with /agent or ⌥ A",
			),
		)
		return
	}

	// Ensure we have a chat to save to
	if (!currentChatIdAtom.get()) {
		await startNewChat()
	}

	addMessage(createUserMessage(userPrompt))

	// Save after user message
	await saveCurrentChat()

	isLoadingAtom.set(true)

	try {
		conversationMessages.push({ role: "user", content: userPrompt })
		// Create assistant message with streaming flag already set
		const assistantMsg = createAssistantMessage()
		assistantMsg.metadata = {
			timestamp: assistantMsg.metadata?.timestamp ?? Date.now(),
			streaming: true,
		}
		const messageAtom = addMessage(assistantMsg)
		await streamAgentResponse(messageAtom)
	} catch (error) {
		// Ignore abort errors (user stopped generation)
		const isAbortError =
			error instanceof Error &&
			(error.name === "AbortError" ||
				error.message.includes("aborted") ||
				error.message.includes("No output generated"))

		if (!isAbortError) {
			addMessage(
				createSystemMessage(
					`Error: ${error instanceof Error ? error.message : String(error)}`,
				),
			)
		}
	} finally {
		isLoadingAtom.set(false)
	}
}

// Subscribe to agent changes and load the agent
currentAgentAtom.sub((agentName) => {
	if (agentName) {
		loadAgent(agentName)
	}
})

/**
 * Handle a tool approval response.
 * Updates the message part to approval-responded and continues the agent stream.
 */
export async function handleToolApproval(approved: boolean): Promise<boolean> {
	const pendingApproval = pendingApprovalsAtom.get()[0]
	if (!pendingApproval) {
		debugLog("No pending approval to handle")
		return false
	}

	const { toolCallId, approvalId, messageAtom, toolName } = pendingApproval

	// Update the message part to approval-responded
	const message = messageAtom.get()
	const updatedParts = message.parts.map((part) => {
		const toolPart = part as ToolData
		if (
			(part.type.startsWith("tool-") || part.type === "dynamic-tool") &&
			toolPart.toolCallId === toolCallId &&
			toolPart.state === "approval-requested"
		) {
			return {
				...toolPart,
				state: "approval-responded",
				approval: {
					id: approvalId,
					approved,
					reason: approved ? undefined : "Denied by user",
				},
			}
		}
		return part
	})

	messageAtom.set({ ...message, parts: updatedParts as TUIMessage["parts"] })
	removePendingApproval(toolCallId)
	debugLog(
		`Tool ${toolName} ${approved ? "approved" : "denied"} (${toolCallId})`,
	)

	// Save after tool approval state change
	await saveCurrentChat()

	if (approved && currentAgentInstance) {
		isLoadingAtom.set(true)
		try {
			await streamAgentResponse(messageAtom)
		} catch (error) {
			// Ignore abort errors (user stopped generation)
			const isAbortError = error instanceof Error && error.name === "AbortError"

			if (!isAbortError) {
				addMessage(
					createSystemMessage(
						`Error: ${error instanceof Error ? error.message : String(error)}`,
					),
				)
			}
		} finally {
			isLoadingAtom.set(false)
		}
	}

	return true
}
