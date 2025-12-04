import { readdir, stat } from "node:fs/promises"
import path from "node:path"

export interface DiscoveredAgent {
	name: string
	path: string
}

async function discoverAgentsFromPath(
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

	return agents
}

/**
 * Discover agents from multiple paths. Earlier paths take precedence
 * over later paths when agents have the same name.
 */
export async function discoverAgents(
	agentPaths: string | string[],
): Promise<DiscoveredAgent[]> {
	const paths = Array.isArray(agentPaths) ? agentPaths : [agentPaths]
	const seenNames = new Set<string>()
	const agents: DiscoveredAgent[] = []

	for (const agentPath of paths) {
		const discovered = await discoverAgentsFromPath(agentPath)
		for (const agent of discovered) {
			if (!seenNames.has(agent.name)) {
				seenNames.add(agent.name)
				agents.push(agent)
			}
		}
	}

	return agents.sort((a, b) => a.name.localeCompare(b.name))
}
