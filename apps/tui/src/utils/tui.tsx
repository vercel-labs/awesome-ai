import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "../components/app"
import {
	addMessage,
	availableAgentsAtom,
	currentAgentAtom,
	currentChatIdAtom,
	cwdAtom,
	execModeAtom,
	execPromptAtom,
	rendererAtom,
	selectedModelAtom,
	setMessages,
} from "../components/atoms"
import { createSystemMessage } from "../types"
import { discoverAgents } from "./agent-discovery"
import { loadPromptContent } from "./prompt-loader"
import { loadSettings } from "./settings"
import { loadChat } from "./storage"

export interface RunTuiOptions {
	/** Array of paths to look for agents, order matters (earlier paths take precedence) */
	agentPaths: string[]
	initialAgent?: string
	cwd: string
	// Exec mode options (when both are provided, exec mode is enabled)
	/** Array of paths to look for prompts, order matters (earlier paths take precedence) */
	promptsPaths?: string[]
	promptName?: string
}

export async function runTui(options: RunTuiOptions) {
	const { agentPaths, initialAgent, cwd, promptsPaths, promptName } = options
	const isExecMode = promptsPaths && promptsPaths.length > 0 && promptName

	cwdAtom.set(cwd)

	const settings = await loadSettings()

	if (settings.model) {
		selectedModelAtom.set(settings.model)
	}

	// Load last chat if available
	if (settings.lastChatId) {
		const chat = await loadChat(settings.lastChatId)
		if (chat) {
			currentChatIdAtom.set(chat.id)
			setMessages(chat.messages)
		}
	}

	const agents = await discoverAgents(agentPaths)
	availableAgentsAtom.set(agents)

	// In exec mode, require at least one agent
	if (isExecMode && agents.length === 0) {
		console.error(
			`No agents found in ${agentPaths.join(" or ")}. Add agent files with 'awesome-ai add [agent-name]' or use --remote`,
		)
		process.exit(1)
	}

	// Determine which agent to use (priority: CLI arg > saved setting > first available)
	const agentToSelect = initialAgent || settings.agent
	const firstAgent = agents[0]

	// Set initial agent if provided and exists
	if (agentToSelect) {
		const agentExists = agents.find((a) => a.name === agentToSelect)

		if (agentExists) {
			currentAgentAtom.set(agentToSelect)
		} else if (isExecMode && initialAgent) {
			// Fatal error in exec mode when explicitly requested
			console.error(
				`Agent "${agentToSelect}" not found. Available agents: ${agents.map((a) => a.name).join(", ")}`,
			)
			process.exit(1)
		} else if (initialAgent) {
			// Non-fatal for CLI-specified agent in regular mode
			addMessage(
				createSystemMessage(
					`Agent "${agentToSelect}" not found. Available agents: ${agents.map((a) => a.name).join(", ") || "none"}`,
				),
			)
			// Fall back to first agent
			if (firstAgent) {
				currentAgentAtom.set(firstAgent.name)
			}
		} else {
			// Saved agent not found, silently fall back to first agent
			if (firstAgent) {
				currentAgentAtom.set(firstAgent.name)
			}
		}
	} else if (firstAgent) {
		// Auto-select first agent if none specified
		currentAgentAtom.set(firstAgent.name)
	} else {
		addMessage(
			createSystemMessage(
				`No agents found in ${agentPaths.join(" or ")}. Create agent files in this directory.`,
			),
		)
	}

	if (isExecMode) {
		let promptContent: string | null = null

		for (const promptPath of promptsPaths) {
			promptContent = await loadPromptContent(promptPath, promptName)
			if (promptContent) break
		}

		if (!promptContent) {
			console.error(
				`Prompt "${promptName}" not found or could not be loaded from ${promptsPaths.join(" or ")}`,
			)
			process.exit(1)
		}

		execModeAtom.set(true)
		execPromptAtom.set({ name: promptName, content: promptContent })
	}

	const renderer = await createCliRenderer({
		exitOnCtrlC: false,
	})

	rendererAtom.set(renderer)

	createRoot(renderer).render(<App />)
}
