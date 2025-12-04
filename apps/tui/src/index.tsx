import { runTui } from "./utils/tui"

export { runTui }

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
