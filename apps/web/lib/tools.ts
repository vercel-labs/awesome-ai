import { fetchRegistryFile } from "./registry"

export interface Tool {
	name: string
	title: string
	description: string
	dependencies: string[]
}

export interface ToolDetail extends Tool {
	files: Array<{
		path: string
		type: string
		content: string
	}>
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
	}>
}

interface RegistryItem {
	name: string
	type: string
	title: string
	description: string
	dependencies?: string[]
	files: Array<{
		path: string
		type: string
		content: string
	}>
}

function toTool(item: RegistryIndex["items"][number]): Tool {
	return {
		name: item.name,
		title: item.title,
		description: item.description,
		dependencies: item.dependencies ?? [],
	}
}

export async function getAllTools(): Promise<Tool[]> {
	const registry = await fetchRegistryFile<RegistryIndex>(
		"tools/registry.json",
	)
	return registry.items.map(toTool)
}

export async function getToolBySlug(slug: string): Promise<ToolDetail | undefined> {
	try {
		const item = await fetchRegistryFile<RegistryItem>(
			`tools/${slug}.json`,
		)
		return {
			name: item.name,
			title: item.title,
			description: item.description,
			dependencies: item.dependencies ?? [],
			files: item.files,
		}
	} catch {
		return undefined
	}
}
