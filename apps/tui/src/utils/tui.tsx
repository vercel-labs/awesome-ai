import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "../components/app"
import {
	addMessage,
	availableAgentsAtom,
	currentAgentAtom,
	execModeAtom,
	execPromptAtom,
	rendererAtom,
} from "../components/atoms"
import { createSystemMessage } from "../types"
import { setCwd } from "./agent"
import { discoverAgents } from "./agent-discovery"
import { loadPromptContent } from "./prompt-loader"

export interface RunTuiOptions {
	agentsPath: string
	initialAgent?: string
	cwd: string
	// Exec mode options (when both are provided, exec mode is enabled)
	promptsPath?: string
	promptName?: string
}

export async function runTui(options: RunTuiOptions) {
	const { agentsPath, initialAgent, cwd, promptsPath, promptName } = options
	const isExecMode = promptsPath && promptName

	// Store cwd globally for agent loading
	setCwd(cwd)

	// Discover agents from the provided path
	const agents = await discoverAgents(agentsPath)
	availableAgentsAtom.set(agents)

	// In exec mode, require at least one agent
	if (isExecMode && agents.length === 0) {
		console.error(
			`No agents found in ${agentsPath}. Add agent files in this directory with 'awesome-ai add [agent-name]'`,
		)
		process.exit(1)
	}

	// Set initial agent if provided and exists
	if (initialAgent) {
		const agentExists = agents.find((a) => a.name === initialAgent)

		if (agentExists) {
			currentAgentAtom.set(initialAgent)
		} else if (isExecMode) {
			// Fatal error in exec mode
			console.error(
				`Agent "${initialAgent}" not found. Available agents: ${agents.map((a) => a.name).join(", ")}`,
			)
			process.exit(1)
		} else {
			// Non-fatal in regular mode
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

	if (isExecMode) {
		const promptContent = await loadPromptContent(promptsPath, promptName)
		if (!promptContent) {
			console.error(
				`Prompt "${promptName}" not found or could not be loaded from ${promptsPath}`,
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
