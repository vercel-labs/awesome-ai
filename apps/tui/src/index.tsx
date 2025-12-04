import { type DiscoveredAgent, discoverAgents } from "./utils/agent-discovery"
import { type RunTuiOptions, runTui } from "./utils/tui"

export { runTui, discoverAgents }
export type { RunTuiOptions, DiscoveredAgent }

// Run when executed directly (for testing without CLI)
if (import.meta.main) {
	const args = process.argv.slice(2)

	// Simple arg parsing for direct execution
	const agentPaths: string[] = []
	let initialAgent: string | undefined
	let cwd = process.cwd()

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		const nextArg = args[i + 1]
		if (arg === "--agents-path" && nextArg) {
			agentPaths.push(nextArg)
			i++
		} else if (arg === "--cwd" && nextArg) {
			cwd = nextArg
			i++
		} else if (arg && !arg.startsWith("-")) {
			initialAgent = arg
		}
	}

	// Default to ./src/agents if no paths provided
	if (agentPaths.length === 0) {
		agentPaths.push("./src/agents")
	}

	runTui({ agentPaths, initialAgent, cwd })
}
