import { type Atom, atom } from "@lfades/atom"
import type { TextareaRenderable } from "@opentui/core"
import testConversationData from "../test-conversation.json"
import type { TUIMessage } from "../types"
import type { DiscoveredAgent } from "../utils/agent-discovery"
import type { AvailableModel } from "../utils/models"

export type MessageAtom = Atom<TUIMessage>

// Set to true to load test conversation on startup
const USE_TEST_CONVERSATION = true

// Create atoms from test conversation data
function createTestMessageAtoms() {
	return (testConversationData as TUIMessage[]).map((msg) => atom(msg))
}

export const messagesAtom = atom<MessageAtom[]>(
	USE_TEST_CONVERSATION ? createTestMessageAtoms() : [],
)

export function addMessage(message: TUIMessage): MessageAtom {
	const messageAtom = atom(message)
	messagesAtom.set([...messagesAtom.get(), messageAtom])
	return messageAtom
}

export function clearMessages() {
	messagesAtom.set([])
}

export const isLoadingAtom = atom(false)
export const showDebugAtom = atom(false)
export const debugLogsAtom = atom<string[]>([])
export const selectedModelAtom = atom("anthropic/claude-opus-4.5")
export const showCommandsAtom = atom(false)
export const commandFilterAtom = atom("")
export const selectedCommandAtom = atom(0)
export const showShortcutsAtom = atom(false)
export const inputAtom = atom<TextareaRenderable | null>(null)

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
