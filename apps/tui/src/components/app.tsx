import { useAtom } from "@lfades/atom"
import { useKeyboard, useRenderer } from "@opentui/react"
import { colors } from "../theme"
import { handleToolApproval, stopGeneration } from "../utils/agent"
import { copyToClipboard } from "../utils/clipboard"
import { AgentSelector, handleAgentSelectorKey } from "./agent-selector"
import {
	currentAgentAtom,
	execModeAtom,
	exitTui,
	scrollToBottom,
	showAgentSelectorAtom,
	showAlert,
	showCommandsAtom,
	showDebugAtom,
	showModelSelectorAtom,
	showShortcutsAtom,
} from "./atoms"
import { CommandPalette } from "./command-palette"
import { DebugOverlay } from "./debug-overlay"
import { Footer } from "./footer"
import { Header } from "./header"
import { InputArea } from "./input-area"
import { MessageList } from "./message-list"
import { handleModelSelectorKey, ModelSelector } from "./model-selector"
import { handlePromptApproval, PromptApproval } from "./prompt-approval"
import { ShortcutsPanel } from "./shortcuts-panel"
import { AlertContainer } from "./ui/alert"

function Chat() {
	const [showDebug, setShowDebug] = useAtom(showDebugAtom)
	const [showShortcuts] = useAtom(showShortcutsAtom)
	const [showCommands] = useAtom(showCommandsAtom)
	const [showAgentSelector] = useAtom(showAgentSelectorAtom)
	const [showModelSelector] = useAtom(showModelSelectorAtom)
	const [currentAgent] = useAtom(currentAgentAtom)
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

		// Ctrl+C to exit
		if (key.name === "c" && key.ctrl) {
			key.preventDefault()
			exitTui()
			return
		}

		// Alt+A to toggle agent selector
		if (key.name === "a" && (key.meta || key.option)) {
			key.preventDefault()
			showAgentSelectorAtom.set(!showAgentSelectorAtom.get())
			return
		}

		// Alt+M to toggle model selector
		if (key.name === "m" && (key.meta || key.option)) {
			key.preventDefault()
			showModelSelectorAtom.set(!showModelSelectorAtom.get())
			return
		}

		// Alt+D to toggle debug overlay
		if (key.name === "d" && (key.meta || key.option)) {
			key.preventDefault()
			setShowDebug(!showDebugAtom.get())
			return
		}

		// Alt+S to toggle shortcuts panel
		if (key.name === "s" && (key.meta || key.option)) {
			key.preventDefault()
			showShortcutsAtom.set(!showShortcutsAtom.get())
			return
		}

		// Alt+Y to approve pending tool
		if (key.name === "y" && (key.meta || key.option)) {
			key.preventDefault()
			handleToolApproval(true)
			return
		}

		// Alt+N to deny pending tool
		if (key.name === "n" && (key.meta || key.option)) {
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
		if (key.name === "escape" && showShortcutsAtom.get()) {
			key.preventDefault()
			showShortcutsAtom.set(false)
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

			<AlertContainer />
		</box>
	)
}

export function App() {
	const [execMode] = useAtom(execModeAtom)

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
