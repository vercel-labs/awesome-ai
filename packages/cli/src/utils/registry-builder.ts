import { promises as fs } from "fs"
import path from "path"
import type { RegistryItem, RegistryItemConfig } from "../registry/schema"
import { extractImports } from "./extract-imports"

export type ItemType = "tools" | "agents" | "prompts"

function toTitleCase(str: string): string {
	return str
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

function extractDescription(content: string, name: string, type: ItemType): string {
	if (type === "tools") {
		const constDescMatch = content.match(/^const description\s*=\s*`([^`]+)`/m)
		if (constDescMatch) {
			const fullDesc = constDescMatch[1]!.trim()
			const firstLine = fullDesc.split("\n")[0]!.trim()
			return firstLine.length > 100 ? `${firstLine.slice(0, 100)}...` : firstLine
		}
	}

	if (type === "prompts") {
		const promptMatch = content.match(/(?:PROMPT|prompt)\s*=\s*`\s*\n?([^`]+)/)
		if (promptMatch) {
			const lines = promptMatch[1]!.split("\n").filter((l) => l.trim())
			if (lines.length > 0) {
				const firstLine = lines[0]!.trim()
				return firstLine.length > 100 ? `${firstLine.slice(0, 100)}...` : firstLine
			}
		}
	}

	if (type === "agents") {
		const topJsdocMatch = content.match(/^\/\*\*\s*\n\s*\*\s*(.+?)(?:\n|\*\/)/s)
		if (topJsdocMatch) {
			return topJsdocMatch[1]!.trim()
		}
	}

	const defaults: Record<string, string> = {
		tools: `${toTitleCase(name)} tool for AI agents`,
		agents: `${toTitleCase(name)} - an AI agent`,
		prompts: `System prompt for ${toTitleCase(name)}`,
	}
	return defaults[type] || `${toTitleCase(name)} for AI agents`
}

function extractCategories(content: string): string[] {
	const jsdocMatch = content.match(/^\/\*\*([\s\S]*?)\*\//)
	if (!jsdocMatch) return []

	const categories: string[] = []
	const categoryRegex = /@category\s+(\S+)/g
	let match: RegExpExecArray | null
	while ((match = categoryRegex.exec(jsdocMatch[1]!)) !== null) {
		categories.push(match[1]!)
	}
	return categories
}

function extractConfig(content: string): RegistryItemConfig[] {
	const jsdocMatch = content.match(/^\/\*\*([\s\S]*?)\*\//)
	if (!jsdocMatch) return []

	const configMap = new Map<string, RegistryItemConfig>()
	const configRegex = /@config\s+(\S+)\s+(.+)/g
	let match: RegExpExecArray | null

	while ((match = configRegex.exec(jsdocMatch[1]!)) !== null) {
		const name = match[1]!
		const rest = match[2]!.trim()

		const envMatch = rest.match(/^env\s+(\S+)$/)
		if (envMatch) {
			const existing = configMap.get(name)
			if (existing) {
				existing.env = envMatch[1]!
			} else {
				configMap.set(name, {
					name,
					type: "string",
					required: false,
					description: "",
					env: envMatch[1]!,
				})
			}
			continue
		}

		const fieldMatch = rest.match(/^(\w+)(\?)?\s*-\s*(.+)$/)
		if (fieldMatch) {
			const existing = configMap.get(name)
			const entry: RegistryItemConfig = {
				name,
				type: fieldMatch[1]!,
				required: !fieldMatch[2],
				description: fieldMatch[3]!.trim(),
				...(existing?.env ? { env: existing.env } : {}),
			}
			configMap.set(name, entry)
		}
	}

	return [...configMap.values()]
}

function extractContext(content: string): string[] {
	const jsdocMatch = content.match(/^\/\*\*([\s\S]*?)\*\//)
	if (!jsdocMatch) return []

	const contexts: string[] = []
	const contextRegex = /@context\s+(\S+)/g
	let match: RegExpExecArray | null
	while ((match = contextRegex.exec(jsdocMatch[1]!)) !== null) {
		contexts.push(match[1]!)
	}
	return contexts
}

/**
 * Read a lib file from a type's lib/ directory.
 */
async function readLibFile(
	srcDir: string,
	libName: string,
	type: ItemType,
): Promise<{ path: string; content: string } | null> {
	const libPath = path.join(srcDir, type, "lib", `${libName}.ts`)
	try {
		const content = await fs.readFile(libPath, "utf-8")
		return { path: `${type}/lib/${libName}.ts`, content }
	} catch {
		return null
	}
}

/**
 * Process a single TypeScript source file into a RegistryItem.
 */
async function processSourceFile(
	filePath: string,
	type: ItemType,
	baseDir: string,
	srcDir: string,
	npmPackages: Set<string>,
): Promise<RegistryItem | null> {
	const baseName = path.basename(filePath, ".ts")

	if (baseName.endsWith(".test") || filePath.includes("__tests__") || filePath.includes("/lib/")) {
		return null
	}

	const relativePath = path.relative(baseDir, filePath)
	const name = relativePath.replace(/\.ts$/, "")

	const content = await fs.readFile(filePath, "utf-8")
	const { npmDeps, npmDevDeps, registryDeps, toolLibFiles, agentLibFiles, relativeLibFiles } =
		extractImports(content, { npmPackages })
	const description = extractDescription(content, baseName, type)

	const registryType = `registry:${type.slice(0, -1)}` as RegistryItem["type"]

	const files: RegistryItem["files"] = [{ path: `${type}/${name}.ts`, type: registryType, content }]

	for (const lib of toolLibFiles) {
		const libFile = await readLibFile(srcDir, lib, "tools")
		if (libFile) {
			files.push({
				path: libFile.path,
				type: "registry:lib",
				content: libFile.content,
			})
		}
	}

	for (const lib of agentLibFiles) {
		const libFile = await readLibFile(srcDir, lib, "agents")
		if (libFile) {
			files.push({
				path: libFile.path,
				type: "registry:lib",
				content: libFile.content,
			})
		}
	}

	const fileDir = path.dirname(filePath)
	for (const lib of relativeLibFiles) {
		const libPath = path.join(fileDir, "lib", `${lib}.ts`)
		try {
			const libContent = await fs.readFile(libPath, "utf-8")
			const libRelativePath = path.relative(baseDir, libPath)
			files.push({
				path: `${type}/${libRelativePath}`,
				type: "registry:lib",
				content: libContent,
			})
		} catch {
			// Ignore missing lib files
		}
	}

	const item: RegistryItem = {
		name,
		type: registryType,
		title: toTitleCase(baseName),
		description,
		files,
	}

	if (npmDeps.length > 0) item.dependencies = npmDeps
	if (npmDevDeps.length > 0) item.devDependencies = npmDevDeps
	if (registryDeps.length > 0) item.registryDependencies = registryDeps

	const categories = extractCategories(content)
	if (categories.length > 0) item.categories = categories

	const config = extractConfig(content)
	if (config.length > 0) item.config = config

	const context = extractContext(content)
	if (context.length > 0) item.context = context

	return item
}

/**
 * Walk a directory and process all TypeScript source files into RegistryItems.
 */
export async function processDirectory(
	type: ItemType,
	baseDir: string,
	srcDir: string,
	npmPackages: Set<string>,
): Promise<RegistryItem[]> {
	const items: RegistryItem[] = []

	async function walk(dirPath: string): Promise<void> {
		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name)
				if (entry.isDirectory()) {
					if (entry.name === "lib" || entry.name === "__tests__") continue
					await walk(fullPath)
				} else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
					const item = await processSourceFile(fullPath, type, baseDir, srcDir, npmPackages)
					if (item) items.push(item)
				}
			}
		} catch {
			// Directory doesn't exist or isn't readable
		}
	}

	await walk(baseDir)
	return items
}

/**
 * Build a registry index object from a list of items.
 */
export function buildRegistryIndex(
	items: RegistryItem[],
	type: string,
): { name: string; homepage: string; items: Omit<RegistryItem, "files">[] } {
	return {
		name: `@awesome-ai/${type}`,
		homepage: "https://awesome-ai.com",
		items: items.map(({ files: _, ...rest }) => rest),
	}
}

/**
 * Load npm package names from a project's package.json.
 */
export async function loadNpmPackages(cwd: string): Promise<Set<string>> {
	try {
		const content = await fs.readFile(path.join(cwd, "package.json"), "utf-8")
		const packageJson = JSON.parse(content)
		return new Set(Object.keys(packageJson.dependencies || {}))
	} catch {
		return new Set()
	}
}
