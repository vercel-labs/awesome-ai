import { readdir, stat } from "node:fs/promises"
import path from "node:path"

export interface DiscoveredAgent {
	name: string
	path: string
}

export async function discoverAgents(
	agentsPath: string,
): Promise<DiscoveredAgent[]> {
	const agents: DiscoveredAgent[] = []

	try {
		const entries = await readdir(agentsPath)

		for (const entry of entries) {
			const entryPath = path.join(agentsPath, entry)
			const entryStat = await stat(entryPath)

			if (entryStat.isDirectory()) continue
			if (
				!entry.endsWith(".ts") &&
				!entry.endsWith(".tsx") &&
				!entry.endsWith(".js") &&
				!entry.endsWith(".jsx")
			) {
				continue
			}

			// Extract agent name from filename (e.g., "coding-agent.ts" -> "coding-agent")
			const name = entry.replace(/\.(tsx?|jsx?)$/, "")

			agents.push({
				name,
				path: entryPath,
			})
		}
	} catch {
		// Directory doesn't exist or can't be read
		return []
	}

	return agents.sort((a, b) => a.name.localeCompare(b.name))
}
