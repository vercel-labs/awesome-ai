import { discoverAgents } from "./utils/agent-discovery"
import { runTui } from "./utils/tui"

export { runTui, discoverAgents }

// Run when executed directly (for testing without CLI)
if (import.meta.main) {
	const args = process.argv.slice(2)

	// Simple arg parsing for direct execution
	let agentsPath = "./src/agents"
	let initialAgent: string | undefined
	let cwd = process.cwd()

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		const nextArg = args[i + 1]
		if (arg === "--agents-path" && nextArg) {
			agentsPath = nextArg
			i++
		} else if (arg === "--cwd" && nextArg) {
			cwd = nextArg
			i++
		} else if (arg && !arg.startsWith("-")) {
			initialAgent = arg
		}
	}

	runTui({ agentsPath, initialAgent, cwd })
}
