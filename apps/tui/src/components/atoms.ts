import { type Atom, atom } from "@lfades/atom"
import type {
	CliRenderer,
	ScrollBoxRenderable,
	TextareaRenderable,
} from "@opentui/core"
import type { TUIMessage } from "../types"
import type { DiscoveredAgent } from "../utils/agent-discovery"
import type { AvailableModel } from "../utils/models"

export type MessageAtom = Atom<TUIMessage>

export const messagesAtom = atom<MessageAtom[]>([])

export function addMessage(message: TUIMessage): MessageAtom {
	const messageAtom = atom(message)
	messagesAtom.set([...messagesAtom.get(), messageAtom])
	return messageAtom
}

export function clearMessages() {
	messagesAtom.set([])
}

export function setMessages(messages: TUIMessage[]) {
	messagesAtom.set(messages.map((msg) => atom(msg)))
}

export const isLoadingAtom = atom(false)
export const showDebugAtom = atom(false)
export const debugLogsAtom = atom<string[]>([])
// Default model - will be overridden by settings if available
export const selectedModelAtom = atom("anthropic/claude-opus-4.5")
// Store cwd for settings persistence
export const cwdAtom = atom<string>(process.cwd())
export const showCommandsAtom = atom(false)
export const commandFilterAtom = atom("")
export const selectedCommandAtom = atom(0)
export const showShortcutsAtom = atom(false)
export const inputAtom = atom<TextareaRenderable | null>(null)
export const messageListScrollboxAtom = atom<ScrollBoxRenderable | null>(null)

export function scrollToBottom() {
	const scrollbox = messageListScrollboxAtom.get()
	if (scrollbox) {
		// Reset manual scroll flag to re-enable sticky behavior
		;(scrollbox as unknown as { _hasManualScroll: boolean })._hasManualScroll =
			false
		// Scroll to the bottom
		const maxScrollTop = Math.max(
			0,
			scrollbox.scrollHeight - scrollbox.viewport.height,
		)
		scrollbox.scrollTop = maxScrollTop
	}
}

// Agent selection
export const showAgentSelectorAtom = atom(false)
export const availableAgentsAtom = atom<DiscoveredAgent[]>([])
export const selectedAgentIndexAtom = atom(0)
export const currentAgentAtom = atom<string | null>(null)

// Model selection
export const showModelSelectorAtom = atom(false)
export const availableModelsAtom = atom<AvailableModel[]>([])
export const selectedModelIndexAtom = atom(0)
export const isLoadingModelsAtom = atom(false)

// Chat history
export const currentChatIdAtom = atom<string | null>(null)
export const showChatPickerAtom = atom(false)
export const chatListAtom = atom<
	{ id: string; title: string; updatedAt: number }[]
>([])
export const selectedChatIndexAtom = atom(0)

export interface PendingApproval {
	toolCallId: string
	approvalId: string
	toolName: string
	messageAtom: MessageAtom
}
export const pendingApprovalsAtom = atom<PendingApproval[]>([])

export function addPendingApproval(approval: PendingApproval) {
	const current = pendingApprovalsAtom.get()
	if (!current.some((a) => a.toolCallId === approval.toolCallId)) {
		pendingApprovalsAtom.set([...current, approval])
	}
}

export function removePendingApproval(toolCallId: string) {
	pendingApprovalsAtom.set(
		pendingApprovalsAtom.get().filter((a) => a.toolCallId !== toolCallId),
	)
}

export function debugLog(...args: unknown[]) {
	const msg = args
		.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
		.join(" ")

	debugLogsAtom.set([...debugLogsAtom.get().slice(-99), msg])
}

// Alert system for toast notifications
export interface AlertMessage {
	id: string
	message: string
	type: "success" | "info" | "error"
}

export const alertsAtom = atom<AlertMessage[]>([])

let alertIdCounter = 0

export function showAlert(
	message: string,
	type: AlertMessage["type"] = "success",
	duration = 2500,
) {
	const id = `alert-${++alertIdCounter}`
	const alert: AlertMessage = { id, message, type }

	alertsAtom.set([...alertsAtom.get(), alert])

	// Auto-dismiss after duration
	setTimeout(() => {
		alertsAtom.set(alertsAtom.get().filter((a) => a.id !== id))
	}, duration)

	return id
}

export function dismissAlert(id: string) {
	alertsAtom.set(alertsAtom.get().filter((a) => a.id !== id))
}

interface ExecPrompt {
	name: string
	content: string
}

export const execModeAtom = atom(false)
export const execPromptAtom = atom<ExecPrompt | null>(null)

// TUI
export const rendererAtom = atom<CliRenderer | null>(null)

export function exitTui(message?: string) {
	const renderer = rendererAtom.get()
	if (renderer) renderer.destroy()
	if (message) {
		console.log(message)
	}
	process.exit(0)
}
