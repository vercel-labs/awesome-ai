import { type Atom, atom, useAtom } from "@lfades/atom"
import type {
	CliRenderer,
	ScrollBoxRenderable,
	TextareaRenderable,
} from "@opentui/core"
import { createContext, type ReactNode, useContext, useMemo } from "react"
import type { TUIMessage } from "../types"
import type { DiscoveredAgent } from "../utils/agent-discovery"
import type { AvailableModel } from "../utils/models"

export type MessageAtom = Atom<TUIMessage>

export interface PendingApproval {
	toolCallId: string
	approvalId: string
	toolName: string
	messageAtom: MessageAtom
}

// Alert system for toast notifications
export interface AlertMessage {
	id: string
	message: string
	type: "success" | "info" | "error"
}

interface ExecPrompt {
	name: string
	content: string
}

export interface AppAtomsInit {
	messages: TUIMessage[]
	isLoading: boolean
	showDebug: boolean
	debugLogs: string[]
	selectedModel: string
	cwd: string
	showCommands: boolean
	commandFilter: string
	selectedCommand: number
	showShortcuts: boolean
	input: TextareaRenderable | null
	messageListScrollbox: ScrollBoxRenderable | null
	showAgentSelector: boolean
	availableAgents: DiscoveredAgent[]
	selectedAgentIndex: number
	currentAgent: string | null
	showModelSelector: boolean
	availableModels: AvailableModel[]
	selectedModelIndex: number
	isLoadingModels: boolean
	currentChatId: string | null
	showChatPicker: boolean
	chatList: { id: string; title: string; updatedAt: number }[]
	selectedChatIndex: number
	pendingApprovals: PendingApproval[]
	alerts: AlertMessage[]
	execMode: boolean
	execPrompt: ExecPrompt | null
	renderer: CliRenderer | null
}
export function createAppAtoms(initial?: Partial<AppAtomsInit>) {
	return {
		messagesAtom: atom<MessageAtom[]>(
			(initial?.messages ?? []).map((msg) => atom(msg)),
		),
		isLoadingAtom: atom(initial?.isLoading ?? false),
		showDebugAtom: atom(initial?.showDebug ?? false),
		debugLogsAtom: atom(initial?.debugLogs ?? []),
		selectedModelAtom: atom(
			initial?.selectedModel ?? "anthropic/claude-opus-4.5",
		),
		cwdAtom: atom(initial?.cwd ?? process.cwd()),
		showCommandsAtom: atom(initial?.showCommands ?? false),
		commandFilterAtom: atom(initial?.commandFilter ?? ""),
		selectedCommandAtom: atom(initial?.selectedCommand ?? 0),
		showShortcutsAtom: atom(initial?.showShortcuts ?? false),
		inputAtom: atom(initial?.input ?? null),
		messageListScrollboxAtom: atom(initial?.messageListScrollbox ?? null),
		showAgentSelectorAtom: atom(initial?.showAgentSelector ?? false),
		availableAgentsAtom: atom(initial?.availableAgents ?? []),
		selectedAgentIndexAtom: atom(initial?.selectedAgentIndex ?? 0),
		currentAgentAtom: atom(initial?.currentAgent ?? null),
		showModelSelectorAtom: atom(initial?.showModelSelector ?? false),
		availableModelsAtom: atom(initial?.availableModels ?? []),
		selectedModelIndexAtom: atom(initial?.selectedModelIndex ?? 0),
		isLoadingModelsAtom: atom(initial?.isLoadingModels ?? false),
		currentChatIdAtom: atom(initial?.currentChatId ?? null),
		showChatPickerAtom: atom(initial?.showChatPicker ?? false),
		chatListAtom: atom(initial?.chatList ?? []),
		selectedChatIndexAtom: atom(initial?.selectedChatIndex ?? 0),
		pendingApprovalsAtom: atom(initial?.pendingApprovals ?? []),
		alertsAtom: atom(initial?.alerts ?? []),
		execModeAtom: atom(initial?.execMode ?? false),
		execPromptAtom: atom(initial?.execPrompt ?? null),
		rendererAtom: atom(initial?.renderer ?? null),
	}
}

export type AppAtoms = ReturnType<typeof createAppAtoms>

export function createAppActions(atoms: AppAtoms) {
	let alertIdCounter = 0

	const addMessage = (message: TUIMessage): MessageAtom => {
		const messageAtom = atom(message)
		atoms.messagesAtom.set([...atoms.messagesAtom.get(), messageAtom])
		return messageAtom
	}

	const clearMessages = () => {
		atoms.messagesAtom.set([])
	}

	const setMessages = (messages: TUIMessage[]) => {
		atoms.messagesAtom.set(messages.map((msg) => atom(msg)))
	}

	const scrollToBottom = () => {
		const scrollbox = atoms.messageListScrollboxAtom.get()
		if (scrollbox) {
			// Reset manual scroll flag to re-enable sticky behavior
			;(
				scrollbox as unknown as { _hasManualScroll: boolean }
			)._hasManualScroll = false
			// Scroll to the bottom
			const maxScrollTop = Math.max(
				0,
				scrollbox.scrollHeight - scrollbox.viewport.height,
			)
			scrollbox.scrollTop = maxScrollTop
		}
	}

	const addPendingApproval = (approval: PendingApproval) => {
		const current = atoms.pendingApprovalsAtom.get()
		if (!current.some((a) => a.toolCallId === approval.toolCallId)) {
			atoms.pendingApprovalsAtom.set([...current, approval])
		}
	}

	const removePendingApproval = (toolCallId: string) => {
		atoms.pendingApprovalsAtom.set(
			atoms.pendingApprovalsAtom
				.get()
				.filter((a) => a.toolCallId !== toolCallId),
		)
	}

	const debugLog = (...args: unknown[]) => {
		const msg = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ")

		atoms.debugLogsAtom.set([...atoms.debugLogsAtom.get().slice(-99), msg])
	}

	const showAlert = (
		message: string,
		type: AlertMessage["type"] = "success",
		duration = 2500,
	) => {
		const id = `alert-${++alertIdCounter}`
		const alert: AlertMessage = { id, message, type }

		atoms.alertsAtom.set([...atoms.alertsAtom.get(), alert])

		// Auto-dismiss after duration
		setTimeout(() => {
			atoms.alertsAtom.set(atoms.alertsAtom.get().filter((a) => a.id !== id))
		}, duration)

		return id
	}

	const dismissAlert = (id: string) => {
		atoms.alertsAtom.set(atoms.alertsAtom.get().filter((a) => a.id !== id))
	}

	const exitTui = (message?: string) => {
		const renderer = atoms.rendererAtom.get()
		if (renderer) renderer.destroy()
		if (message) {
			console.log(message)
		}
		process.exit(0)
	}

	return {
		addMessage,
		clearMessages,
		setMessages,
		scrollToBottom,
		addPendingApproval,
		removePendingApproval,
		debugLog,
		showAlert,
		dismissAlert,
		exitTui,
	}
}

export type AppActions = ReturnType<typeof createAppActions>

export function createAppStore(initial?: Partial<AppAtomsInit>) {
	const atoms = createAppAtoms(initial)
	const actions = createAppActions(atoms)
	return { atoms, actions }
}

const AppAtomsContext = createContext<AppAtoms | null>(null)
const AppActionsContext = createContext<AppActions | null>(null)

export function AppAtomsProvider({
	children,
	atoms,
	initial,
}: {
	children: ReactNode
	atoms?: AppAtoms
	initial?: Partial<AppAtomsInit>
}) {
	const value = useMemo(
		() => atoms ?? createAppAtoms(initial),
		[atoms, initial],
	)
	const actions = useMemo(() => createAppActions(value), [value])
	return (
		<AppAtomsContext.Provider value={value}>
			<AppActionsContext.Provider value={actions}>
				{children}
			</AppActionsContext.Provider>
		</AppAtomsContext.Provider>
	)
}

export function useAppAtoms() {
	const atoms = useContext(AppAtomsContext)
	if (!atoms) {
		throw new Error("useAppAtoms must be used within AppAtomsProvider")
	}
	return atoms
}

export function useAppActions() {
	const actions = useContext(AppActionsContext)
	if (!actions) {
		throw new Error("useAppActions must be used within AppAtomsProvider")
	}
	return actions
}

export function useMessages() {
	return useAtom(useAppAtoms().messagesAtom)
}

export function useIsLoading() {
	return useAtom(useAppAtoms().isLoadingAtom)
}

export function useShowDebug() {
	return useAtom(useAppAtoms().showDebugAtom)
}

export function useDebugLogs() {
	return useAtom(useAppAtoms().debugLogsAtom)
}

export function useSelectedModel() {
	return useAtom(useAppAtoms().selectedModelAtom)
}

export function useCwd() {
	return useAtom(useAppAtoms().cwdAtom)
}

export function useShowCommands() {
	return useAtom(useAppAtoms().showCommandsAtom)
}

export function useCommandFilter() {
	return useAtom(useAppAtoms().commandFilterAtom)
}

export function useSelectedCommand() {
	return useAtom(useAppAtoms().selectedCommandAtom)
}

export function useShowShortcuts() {
	return useAtom(useAppAtoms().showShortcutsAtom)
}

export function useInput() {
	return useAtom(useAppAtoms().inputAtom)
}

export function useMessageListScrollbox() {
	return useAtom(useAppAtoms().messageListScrollboxAtom)
}

export function useShowAgentSelector() {
	return useAtom(useAppAtoms().showAgentSelectorAtom)
}

export function useAvailableAgents() {
	return useAtom(useAppAtoms().availableAgentsAtom)
}

export function useSelectedAgentIndex() {
	return useAtom(useAppAtoms().selectedAgentIndexAtom)
}

export function useCurrentAgent() {
	return useAtom(useAppAtoms().currentAgentAtom)
}

export function useShowModelSelector() {
	return useAtom(useAppAtoms().showModelSelectorAtom)
}

export function useAvailableModels() {
	return useAtom(useAppAtoms().availableModelsAtom)
}

export function useSelectedModelIndex() {
	return useAtom(useAppAtoms().selectedModelIndexAtom)
}

export function useIsLoadingModels() {
	return useAtom(useAppAtoms().isLoadingModelsAtom)
}

export function useCurrentChatId() {
	return useAtom(useAppAtoms().currentChatIdAtom)
}

export function useShowChatPicker() {
	return useAtom(useAppAtoms().showChatPickerAtom)
}

export function useChatList() {
	return useAtom(useAppAtoms().chatListAtom)
}

export function useSelectedChatIndex() {
	return useAtom(useAppAtoms().selectedChatIndexAtom)
}

export function usePendingApprovals() {
	return useAtom(useAppAtoms().pendingApprovalsAtom)
}

export function useAlerts() {
	return useAtom(useAppAtoms().alertsAtom)
}

export function useExecMode() {
	return useAtom(useAppAtoms().execModeAtom)
}

export function useExecPrompt() {
	return useAtom(useAppAtoms().execPromptAtom)
}

export function useRendererAtom() {
	return useAtom(useAppAtoms().rendererAtom)
}
