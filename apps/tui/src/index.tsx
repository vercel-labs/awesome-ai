import { useAtom } from "@lfades/atom"
import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard, useRenderer } from "@opentui/react"
import {
	AgentSelector,
	handleAgentSelectorKey,
} from "./components/agent-selector"
import {
	addMessage,
	availableAgentsAtom,
	currentAgentAtom,
	showAgentSelectorAtom,
	showAlert,
	showCommandsAtom,
	showDebugAtom,
	showModelSelectorAtom,
	showShortcutsAtom,
} from "./components/atoms"
import { CommandPalette } from "./components/command-palette"
import { DebugOverlay } from "./components/debug-overlay"
import { Footer } from "./components/footer"
import { Header } from "./components/header"
import { InputArea } from "./components/input-area"
import { MessageList } from "./components/message-list"
import {
	handleModelSelectorKey,
	ModelSelector,
} from "./components/model-selector"
import { ShortcutsPanel } from "./components/shortcuts-panel"
import { AlertContainer } from "./components/ui/alert"
import { colors } from "./theme"
import { createSystemMessage } from "./types"
import { handleToolApproval, setCwd, stopGeneration } from "./utils/agent"
import { discoverAgents } from "./utils/agent-discovery"
import { copyToClipboard } from "./utils/clipboard"

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

let renderer: Awaited<ReturnType<typeof createCliRenderer>> | null = null

export interface RunTuiOptions {
	agentsPath: string
	initialAgent?: string
	cwd: string
}

export async function runTui(options: RunTuiOptions) {
	const { agentsPath, initialAgent, cwd } = options

	// Store cwd globally for agent loading
	setCwd(cwd)

	// Discover agents from the provided path
	const agents = await discoverAgents(agentsPath)
	availableAgentsAtom.set(agents)

	// Set initial agent if provided and exists
	if (initialAgent) {
		const agentExists = agents.find((a) => a.name === initialAgent)
		if (agentExists) {
			currentAgentAtom.set(initialAgent)
		} else {
			addMessage(
				createSystemMessage(
					`Agent "${initialAgent}" not found. Available agents: ${agents.map((a) => a.name).join(", ") || "none"}`,
				),
			)
		}
	} else if (agents.length > 0) {
		// Auto-select first agent if none specified
		currentAgentAtom.set(agents[0].name)
	} else {
		addMessage(
			createSystemMessage(
				`No agents found in ${agentsPath}. Create agent files in this directory.`,
			),
		)
	}

	renderer = await createCliRenderer({
		exitOnCtrlC: false,
	})

	createRoot(renderer).render(<Chat />)
}

export function exitTui() {
	if (renderer) renderer.destroy()
	process.exit(0)
}

// Run when executed directly (for testing without CLI)
if (import.meta.main) {
	const args = process.argv.slice(2)

	// Simple arg parsing for direct execution
	let agentsPath = "./src/agents"
	let initialAgent: string | undefined
	let cwd = process.cwd()

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === "--agents-path" && args[i + 1]) {
			agentsPath = args[++i]
		} else if (arg === "--cwd" && args[i + 1]) {
			cwd = args[++i]
		} else if (!arg.startsWith("-")) {
			initialAgent = arg
		}
	}

	runTui({ agentsPath, initialAgent, cwd })
}
