import { promises as fs } from "fs"
import path from "path"

export interface Agent {
	name: string
	title: string
	description: string
	categories: string[]
}

/**
 * Read the installed agents from the local .awesome-ai/registry/.
 * Returns an empty array if the registry doesn't exist yet.
 */
export async function getAgents(): Promise<Agent[]> {
	try {
		const indexPath = path.resolve(process.cwd(), ".awesome-ai/registry/agents/registry.json")
		const content = await fs.readFile(indexPath, "utf-8")
		const index = JSON.parse(content)
		return (index.items ?? []).map((item: Record<string, unknown>) => ({
			name: item.name as string,
			title: (item.title as string) ?? item.name,
			description: (item.description as string) ?? "",
			categories: (item.categories as string[]) ?? [],
		}))
	} catch {
		return []
	}
}

export function getAllCategories(agents: Agent[]): string[] {
	const categories = new Set(agents.flatMap((a) => a.categories))
	return [...categories].sort()
}
