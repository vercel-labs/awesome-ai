import { fetchRegistryFile } from "./registry"

// --- Types matching the registry schema ---

export interface AgentConfig {
	name: string
	type: string
	required: boolean
	description: string
	env?: string
}

export interface Agent {
	name: string
	title: string
	description: string
	categories: string[]
	tools: string[]
	promptName: string | null
	dependencies: string[]
	config: AgentConfig[]
}

interface RegistryIndex {
	name: string
	homepage: string
	items: Array<{
		name: string
		type: string
		title: string
		description: string
		dependencies?: string[]
		registryDependencies?: string[]
		categories?: string[]
		config?: AgentConfig[]
	}>
}

interface RegistryItem {
	name: string
	type: string
	title: string
	description: string
	files: Array<{
		path: string
		type: string
		content: string
	}>
}

// --- Transform registry data into Agent shape ---

function toAgent(item: RegistryIndex["items"][number]): Agent {
	const deps = item.registryDependencies ?? []

	const tools = deps
		.filter((d) => d.startsWith("tools:"))
		.map((d) => d.replace("tools:", ""))

	const promptDep = deps.find((d) => d.startsWith("prompts:"))
	const promptName = promptDep ? promptDep.replace("prompts:", "") : null

	return {
		name: item.name,
		title: item.title,
		description: item.description,
		categories: item.categories ?? [],
		tools,
		promptName,
		dependencies: item.dependencies ?? [],
		config: item.config ?? [],
	}
}

// --- Data fetching functions ---

export async function getAllAgents(): Promise<Agent[]> {
	const registry = await fetchRegistryFile<RegistryIndex>(
		"agents/registry.json",
	)
	return registry.items.map(toAgent)
}

export async function getAgentBySlug(slug: string): Promise<Agent | undefined> {
	const agents = await getAllAgents()
	return agents.find((agent) => agent.name === slug)
}

export async function getAllCategories(): Promise<string[]> {
	const agents = await getAllAgents()
	const categories = new Set(agents.flatMap((a) => a.categories))
	return [...categories].sort()
}

export async function getAllTools(): Promise<
	Array<{ name: string; title: string; description: string }>
> {
	const registry = await fetchRegistryFile<RegistryIndex>("tools/registry.json")
	return registry.items.map((item) => ({
		name: item.name,
		title: item.title,
		description: item.description,
	}))
}

/**
 * Extract the prompt text from a prompt's TypeScript source.
 * Looks for the template literal content between backticks.
 */
function extractPromptText(tsSource: string): string {
	const match = tsSource.match(/`\n([\s\S]+?)`\.trim\(\)|`\n([\s\S]+?)`/)
	if (match) {
		return (match[1] ?? match[2] ?? "").trim()
	}
	return tsSource
}

export async function getPromptContent(
	promptName: string,
): Promise<string | null> {
	try {
		const item = await fetchRegistryFile<RegistryItem>(
			`prompts/${promptName}.json`,
		)
		const promptFile = item.files.find((f) => f.type === "registry:prompt")
		if (!promptFile) return null
		return extractPromptText(promptFile.content)
	} catch {
		return null
	}
}
