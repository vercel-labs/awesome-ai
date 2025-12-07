import { type Agent, convertToModelMessages, type ModelMessage } from "ai"
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
// Track approval responses to batch them before continuing
let pendingApprovalResponses: Array<{
	approvalId: string
	approved: boolean
	reason?: string
}> = []

export function resetConversation() {
	conversationMessages = []
	pendingApprovalResponses = []
	// Note: We intentionally don't reset currentAgentInstance here
	// The agent can be reused across conversations
}

function getMessages(): TUIMessage[] {
	return messagesAtom.get().map((atom) => atom.get())
}

/**
 * Rebuild conversationMessages from UI messages when loading a chat from storage
 * or switching between chats.
 *
 * If a previous session was interrupted (app crashed, closed mid-stream), the
 * saved messages might have incomplete tool calls. These are filtered out since
 * they can't be continued and would cause API errors.
 */
export function syncConversationMessages() {
	const uiMessages = getMessages()
	// Filter out system messages (used for TUI notifications, not model context)
	// and filter out incomplete tool calls from assistant messages
	const completedToolStates = new Set([
		"output-available",
		"output-error",
		"output-denied",
	])

	const modelableMessages = uiMessages
		.filter((m) => m.role !== "system")
		.map((m) => {
			if (m.role !== "assistant") return m
			// Filter out tool parts that haven't completed
			const filteredParts = m.parts.filter((part) => {
				// Keep non-tool parts
				if (!part.type.startsWith("tool-") && part.type !== "dynamic-tool") {
					return true
				}
				// Only keep tool parts with completed states
				const toolPart = part as { state?: string }
				return toolPart.state && completedToolStates.has(toolPart.state)
			})
			return { ...m, parts: filteredParts }
		})

	conversationMessages = convertToModelMessages(modelableMessages, {
		tools: currentAgentInstance?.tools,
	})
	debugLog(
		`Synced conversationMessages: ${conversationMessages.length} messages`,
	)
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

// Tool call tracking during streaming
interface ToolCallState {
	toolName: string
	input?: unknown
	inputText: string // For streaming input
	dynamic?: boolean
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
		let hasReasoningPart = false
		const toolCalls = new Map<string, ToolCallState>()

		// Track current text segment - when a tool is added, we start a new segment
		let currentTextSegment = ""
		let currentTextPartIndex = 0 // Index of the current text part we're updating

		const updateReasoningAndText = () => {
			const current = messageAtom.get()
			let parts = [...current.parts] as any[]

			// If we have reasoning text but no reasoning part yet, add one at the start
			if (reasoningText && !hasReasoningPart) {
				debugLog("xD Adding reasoning part to message UwU")
				hasReasoningPart = true
				parts = [{ type: "reasoning" as const, text: reasoningText }, ...parts]
				// Adjust text part index since we inserted at the beginning
				currentTextPartIndex += 1
			}

			// Update reasoning part if it exists
			if (hasReasoningPart && parts[0]?.type === "reasoning") {
				parts[0] = { ...parts[0], text: reasoningText }
			}

			// Update the current text part
			if (parts[currentTextPartIndex]?.type === "text") {
				parts[currentTextPartIndex] = {
					...parts[currentTextPartIndex],
					text: currentTextSegment,
				}
			}

			messageAtom.set({ ...current, parts: parts as TUIMessage["parts"] })
		}

		const addOrUpdateToolPart = (
			toolCallId: string,
			updates: {
				toolName?: string
				state?: ToolData["state"]
				input?: unknown
				output?: unknown
				errorText?: string
				approval?: ToolData["approval"]
				dynamic?: boolean // Not stored in ToolData, only used for type determination
			},
		) => {
			const current = messageAtom.get()
			const existingPartIndex = current.parts.findIndex(
				(p) =>
					(p.type.startsWith("tool-") || p.type === "dynamic-tool") &&
					(p as ToolData).toolCallId === toolCallId,
			)

			if (existingPartIndex >= 0) {
				// Update existing tool part - only update defined fields
				const newParts = [...current.parts] as any[]
				const existingPart = newParts[existingPartIndex] as ToolData
				const updatedPart = { ...existingPart }

				if (updates.state !== undefined) updatedPart.state = updates.state
				if (updates.input !== undefined) updatedPart.input = updates.input
				if (updates.output !== undefined) updatedPart.output = updates.output
				if (updates.errorText !== undefined)
					updatedPart.errorText = updates.errorText
				if (updates.approval !== undefined)
					updatedPart.approval = updates.approval

				newParts[existingPartIndex] = updatedPart
				messageAtom.set({ ...current, parts: newParts })
			} else {
				// Add new tool part
				const toolState = toolCalls.get(toolCallId)
				const toolName = updates.toolName || toolState?.toolName || "unknown"
				const isDynamic = updates.dynamic ?? toolState?.dynamic ?? false
				const { dynamic: _dynamic, ...restUpdates } = updates
				const newPart = {
					type: isDynamic
						? ("dynamic-tool" as const)
						: (`tool-${toolName}` as const),
					toolName: isDynamic ? toolName : undefined,
					toolCallId,
					state: restUpdates.state ?? ("input-streaming" as const),
					input: restUpdates.input,
					output: restUpdates.output,
					errorText: restUpdates.errorText,
					approval: restUpdates.approval,
				} satisfies ToolData

				// Add the tool part and a new empty text part after it
				// This way, any text that comes after the tool will go into the new text part
				const newParts = [...current.parts] as any[]
				newParts.push(newPart)
				newParts.push({ type: "text" as const, text: "" })

				// Update the index to point to the new text part
				currentTextPartIndex = newParts.length - 1
				currentTextSegment = "" // Start fresh for text after the tool

				messageAtom.set({ ...current, parts: newParts })
			}
		}

		for await (const chunk of result.fullStream) {
			switch (chunk.type) {
				case "reasoning-delta":
					reasoningText += chunk.text
					updateReasoningAndText()
					break

				case "text-delta":
					currentTextSegment += chunk.text
					updateReasoningAndText()
					break

				case "tool-input-start": {
					// Tool input is starting to stream
					toolCalls.set(chunk.id, {
						toolName: chunk.toolName,
						inputText: "",
						dynamic: chunk.dynamic,
					})
					addOrUpdateToolPart(chunk.id, {
						toolName: chunk.toolName,
						state: "input-streaming",
						dynamic: chunk.dynamic,
					})
					break
				}

				case "tool-input-delta": {
					// Model is streaming the tool arguments - show partial text to user
					const state = toolCalls.get(chunk.id)
					if (state) {
						state.inputText += chunk.delta
						// Show raw streaming text as input (will be replaced with parsed input on tool-call)
						addOrUpdateToolPart(chunk.id, {
							input: state.inputText,
						})
					}
					break
				}

				case "tool-call": {
					const isDynamic = "dynamic" in chunk && chunk.dynamic
					toolCalls.set(chunk.toolCallId, {
						toolName: chunk.toolName,
						input: chunk.input,
						inputText: JSON.stringify(chunk.input),
						dynamic: isDynamic,
					})
					addOrUpdateToolPart(chunk.toolCallId, {
						toolName: chunk.toolName,
						state: "input-available",
						input: chunk.input,
						dynamic: isDynamic,
					})
					debugLog(`Tool called: ${chunk.toolName}`, chunk.input)
					break
				}

				case "tool-result": {
					// preliminary: true means streaming/intermediate result
					// Only mark as output-available when we get the final result
					const isFinal = !chunk.preliminary
					addOrUpdateToolPart(chunk.toolCallId, {
						state: isFinal ? "output-available" : undefined, // Keep current state if preliminary
						output: chunk.output,
					})
					debugLog(
						`Tool result${chunk.preliminary ? " (streaming)" : ""}: ${chunk.toolCallId}`,
						chunk.output,
					)
					break
				}

				case "tool-error": {
					addOrUpdateToolPart(chunk.toolCallId, {
						state: "output-error",
						errorText:
							chunk.error instanceof Error
								? chunk.error.message
								: String(chunk.error),
					})
					debugLog(`Tool error: ${chunk.toolCallId}`, chunk.error)
					break
				}

				case "tool-approval-request": {
					addOrUpdateToolPart(chunk.toolCall.toolCallId, {
						state: "approval-requested",
						approval: {
							id: chunk.approvalId,
						},
					})
					debugLog(
						`Tool approval requested: ${chunk.toolCall.toolName}`,
						chunk.approvalId,
					)
					break
				}

				case "error":
					throw new Error(String(chunk.error))

				default: {
					// Handle tool-output-denied which may not be in the type union
					const unknownChunk = chunk as any
					if (unknownChunk.type === "tool-output-denied") {
						addOrUpdateToolPart(unknownChunk.toolCallId, {
							state: "output-denied",
						})
						debugLog(`Tool denied: ${unknownChunk.toolCallId}`)
					}
				}
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
	} catch (error) {
		// Clear streaming flag on error so "thinking..." disappears
		const errorMsg = messageAtom.get()
		messageAtom.set({
			...errorMsg,
			metadata: { timestamp: errorMsg.metadata?.timestamp ?? Date.now() },
		})
		throw error
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
				// Sync from existing UI messages if available (e.g., loaded from storage)
				// Otherwise start with empty conversation
				const existingMessages = getMessages()
				if (existingMessages.length > 0) {
					syncConversationMessages()
				} else {
					conversationMessages = []
				}
				return true
			}

			// Some agents might export the agent directly
			if (agentModule.default && agentModule.default.version === "agent-v1") {
				currentAgentInstance = agentModule.default
				// Sync from existing UI messages if available
				const existingMessages = getMessages()
				if (existingMessages.length > 0) {
					syncConversationMessages()
				} else {
					conversationMessages = []
				}
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
 * Updates the message part to approval-responded.
 * Only continues the agent stream after ALL pending approvals are resolved.
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

	pendingApprovalResponses.push({
		approvalId,
		approved,
		reason: approved ? undefined : "Denied by user",
	})

	// Save after tool approval state change
	await saveCurrentChat()

	const remainingApprovals = pendingApprovalsAtom.get()
	if (remainingApprovals.length > 0) {
		debugLog(
			`${remainingApprovals.length} more approval(s) pending, waiting...`,
		)
		return true
	}

	// All approvals resolved - now continue the stream
	// Check if at least one tool was approved
	const hasApproved = pendingApprovalResponses.some((r) => r.approved)

	if (hasApproved && currentAgentInstance) {
		isLoadingAtom.set(true)
		try {
			// Add all approval responses to conversationMessages
			for (const response of pendingApprovalResponses) {
				conversationMessages.push({
					role: "tool",
					content: [
						{
							type: "tool-approval-response",
							approvalId: response.approvalId,
							approved: response.approved,
							reason: response.reason,
						},
					],
				})
			}
			pendingApprovalResponses = []

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
	} else {
		// All tools were denied, clear responses and don't continue
		pendingApprovalResponses = []
		debugLog("All tools were denied, not continuing stream")
	}

	return true
}
