import { useKeyboard, useRenderer } from "@opentui/react"
import { colors } from "../theme"
import { useAgentActions } from "../utils/agent"
import { copyToClipboard } from "../utils/clipboard"
import { AgentSelector, useAgentSelectorKeyHandler } from "./agent-selector"
import {
	useAppActions,
	useCurrentAgent,
	useExecMode,
	useShowAgentSelector,
	useShowChatPicker,
	useShowCommands,
	useShowDebug,
	useShowModelSelector,
	useShowShortcuts,
} from "./atoms"
import { ChatPicker, useChatPickerKeyHandler } from "./chat-picker"
import { CommandPalette } from "./command-palette"
import { DebugOverlay } from "./debug-overlay"
import { Footer } from "./footer"
import { Header } from "./header"
import { InputArea } from "./input-area"
import { MessageList } from "./message-list"
import { ModelSelector, useModelSelectorKeyHandler } from "./model-selector"
import { PromptApproval, usePromptApprovalHandler } from "./prompt-approval"
import { ShortcutsPanel } from "./shortcuts-panel"
import { AlertContainer } from "./ui/alert"

function Chat() {
	const [showDebug, setShowDebug] = useShowDebug()
	const [showShortcuts, setShowShortcuts] = useShowShortcuts()
	const [showCommands] = useShowCommands()
	const [showAgentSelector, setShowAgentSelector] = useShowAgentSelector()
	const [showModelSelector, setShowModelSelector] = useShowModelSelector()
	const [showChatPicker, setShowChatPicker] = useShowChatPicker()
	const [currentAgent] = useCurrentAgent()
	const actions = useAppActions()
	const { exitTui, scrollToBottom, showAlert } = actions
	const agent = useAgentActions()
	const { handleToolApproval, startNewChat, stopGeneration } = agent
	const handleAgentSelectorKey = useAgentSelectorKeyHandler()
	const handleModelSelectorKey = useModelSelectorKeyHandler()
	const handleChatPickerKey = useChatPickerKeyHandler()
	const renderer = useRenderer()

	useKeyboard((key) => {
		// Handle agent selector keyboard events first
		if (handleAgentSelectorKey(key)) {
			key.preventDefault()
			return
		}

		// Handle model selector keyboard events
		if (handleModelSelectorKey(key)) {
			key.preventDefault()
			return
		}

		// Handle chat picker keyboard events
		if (handleChatPickerKey(key)) {
			key.preventDefault()
			return
		}

		// Ctrl+C to exit
		if (key.name === "c" && key.ctrl) {
			key.preventDefault()
			exitTui()
			return
		}

		// Alt+A to toggle agent selector
		if (key.name === "a" && (key.meta || key.option)) {
			key.preventDefault()
			setShowAgentSelector(!showAgentSelector)
			return
		}

		// Alt+M to toggle model selector
		if (key.name === "m" && (key.meta || key.option)) {
			key.preventDefault()
			setShowModelSelector(!showModelSelector)
			return
		}

		// Alt+D to toggle debug overlay
		if (key.name === "d" && (key.meta || key.option)) {
			key.preventDefault()
			setShowDebug(!showDebug)
			return
		}

		// Alt+S to toggle shortcuts panel
		if (key.name === "s" && (key.meta || key.option)) {
			key.preventDefault()
			setShowShortcuts(!showShortcuts)
			return
		}

		// Alt+Y to approve pending tool
		if (key.name === "y" && (key.meta || key.option)) {
			key.preventDefault()
			handleToolApproval(true)
			return
		}

		// Alt+N to start new chat
		if (key.name === "n" && (key.meta || key.option)) {
			key.preventDefault()
			startNewChat()
			showAlert("New chat started")
			return
		}

		// Alt+H to open chat history picker
		if (key.name === "h" && (key.meta || key.option)) {
			key.preventDefault()
			setShowChatPicker(!showChatPicker)
			return
		}

		// Alt+Y to approve pending tool
		if (key.name === "y" && (key.meta || key.option)) {
			key.preventDefault()
			handleToolApproval(true)
			return
		}

		// Alt+R to deny pending tool (reject)
		if (key.name === "r" && (key.meta || key.option)) {
			key.preventDefault()
			handleToolApproval(false)
			return
		}

		// Alt+X to stop generation
		if (key.name === "x" && (key.meta || key.option)) {
			key.preventDefault()
			stopGeneration()
			return
		}

		// Alt+B to scroll to bottom
		if (key.name === "b" && (key.meta || key.option)) {
			key.preventDefault()
			scrollToBottom()
			return
		}

		// Escape to close shortcuts panel
		if (key.name === "escape" && showShortcuts) {
			key.preventDefault()
			setShowShortcuts(false)
			return
		}

		// Copy selected text with Option+C (⌥C)
		if (key.name === "c" && key.meta) {
			const globalSelection = renderer.getSelection()
			if (globalSelection) {
				const selectedText = globalSelection.getSelectedText()
				if (selectedText) {
					key.preventDefault()
					copyToClipboard(selectedText).then((success) => {
						if (success) {
							showAlert("Copied to clipboard")
						} else {
							showAlert("Failed to copy", "error")
						}
					})
					return
				}
			}
		}
	})

	return (
		<box
			style={{
				flexDirection: "column",
				width: "100%",
				height: "100%",
				backgroundColor: colors.bg,
			}}
		>
			<Header agentName={currentAgent || "no agent"} />
			<MessageList />

			{showCommands && <CommandPalette />}

			<InputArea />

			<Footer />

			{showDebug && <DebugOverlay />}
			{showShortcuts && <ShortcutsPanel />}
			{showAgentSelector && <AgentSelector />}
			{showModelSelector && <ModelSelector />}
			{showChatPicker && <ChatPicker />}

			<AlertContainer />
		</box>
	)
}

export function App() {
	const [execMode] = useExecMode()
	const { exitTui } = useAppActions()
	const handlePromptApproval = usePromptApprovalHandler()

	if (execMode) {
		return (
			<PromptApproval
				onApprove={handlePromptApproval}
				onDeny={() => exitTui("Prompt execution denied.")}
			/>
		)
	}

	return <Chat />
}
