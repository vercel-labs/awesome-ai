#!/usr/bin/env bun
/**
 * Build script to generate registry JSON files from TypeScript source files.
 *
 * This script:
 * 1. Reads all tools, agents, and prompts from src/
 * 2. Extracts dependencies and file content
 * 3. Generates JSON files in the registry/ output directory
 * 4. Creates index.json files for each type
 * 5. Validates output against Zod schemas
 */

import { promises as fs } from "fs"
import path from "path"
import { z } from "zod"
import { extractImports } from "./lib/extract-imports"

const SRC_DIR = path.resolve(import.meta.dirname, "../src")
const OUTPUT_DIR = path.resolve(import.meta.dirname, "../registry")
const PACKAGE_JSON_PATH = path.resolve(import.meta.dirname, "../package.json")

// Will be populated from package.json
let NPM_PACKAGES: Set<string>

async function loadNpmPackages(): Promise<Set<string>> {
	const content = await fs.readFile(PACKAGE_JSON_PATH, "utf-8")
	const packageJson = JSON.parse(content)
	const deps = Object.keys(packageJson.dependencies || {})
	// Exclude devDependencies as they shouldn't be installed by consumers
	return new Set(deps)
}

/**
 * Version overrides for specific packages.
 * Use this to pin to specific versions or tags (e.g., "beta" for pre-releases).
 */
const VERSION_OVERRIDES: Record<string, string> = {}

/**
 * Format dependency with version for output.
 */
function formatDependency(name: string): string {
	const override = VERSION_OVERRIDES[name]
	if (override) {
		return `${name}@${override}`
	}
	// No version = npm resolves to latest
	return name
}

// Zod schemas for validation
const registryFileSchema = z.object({
	path: z.string(),
	type: z.string(),
	content: z.string(),
})

const registryConfigSchema = z.object({
	name: z.string(),
	type: z.string(),
	required: z.boolean(),
	description: z.string(),
	env: z.string().optional(),
})

const registryItemSchema = z.object({
	$schema: z.string().optional(),
	name: z.string(),
	type: z.string(),
	title: z.string(),
	description: z.string(),
	dependencies: z.array(z.string()).optional(),
	devDependencies: z.array(z.string()).optional(),
	registryDependencies: z.array(z.string()).optional(),
	categories: z.array(z.string()).optional(),
	config: z.array(registryConfigSchema).optional(),
	files: z.array(registryFileSchema),
})

const registryIndexItemSchema = z.object({
	name: z.string(),
	type: z.string(),
	title: z.string(),
	description: z.string(),
	dependencies: z.array(z.string()).optional(),
	registryDependencies: z.array(z.string()).optional(),
	categories: z.array(z.string()).optional(),
	config: z.array(registryConfigSchema).optional(),
})

const registryIndexSchema = z.object({
	name: z.string(),
	homepage: z.string(),
	items: z.array(registryIndexItemSchema),
})

// Types derived from schemas
type RegistryFile = z.infer<typeof registryFileSchema>
type RegistryItem = z.infer<typeof registryItemSchema>
type RegistryIndex = z.infer<typeof registryIndexSchema>

function toTitleCase(str: string): string {
	return str
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

function extractDescription(
	content: string,
	name: string,
	type: "tools" | "agents" | "prompts",
): string {
	// For tools: Look for const description = `...`
	if (type === "tools") {
		const constDescMatch = content.match(/^const description\s*=\s*`([^`]+)`/m)
		if (constDescMatch) {
			const fullDesc = constDescMatch[1]!.trim()
			const firstLine = fullDesc.split("\n")[0]!.trim()
			return firstLine.length > 100
				? `${firstLine.slice(0, 100)}...`
				: firstLine
		}
	}

	// For prompts: Extract from the prompt content (first meaningful line)
	if (type === "prompts") {
		const promptMatch = content.match(/(?:PROMPT|prompt)\s*=\s*`\s*\n?([^`]+)/)
		if (promptMatch) {
			const lines = promptMatch[1]!.split("\n").filter((l) => l.trim())
			if (lines.length > 0) {
				const firstLine = lines[0]!.trim()
				return firstLine.length > 100
					? `${firstLine.slice(0, 100)}...`
					: firstLine
			}
		}
	}

	// For agents: Look for JSDoc at the very top of the file
	if (type === "agents") {
		const topJsdocMatch = content.match(/^\/\*\*\s*\n\s*\*\s*(.+?)(?:\n|\*\/)/s)
		if (topJsdocMatch) {
			return topJsdocMatch[1]!.trim()
		}
	}

	// Default descriptions based on type
	const defaults: Record<string, string> = {
		tools: `${toTitleCase(name)} tool for AI agents`,
		agents: `${toTitleCase(name)} - an AI agent`,
		prompts: `System prompt for ${toTitleCase(name)}`,
	}
	return defaults[type] || `${toTitleCase(name)} for AI agents`
}

/**
 * Extract @category tags from JSDoc comments.
 * Matches `@category <value>` lines inside a top-level JSDoc block.
 */
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

type ConfigEntry = z.infer<typeof registryConfigSchema>

/**
 * Extract @config tags from JSDoc comments.
 *
 * Supports two formats:
 *   @config <name> <type>[?] - <description>   (field definition)
 *   @config <name> env <ENV_VAR_NAME>           (env var binding)
 *
 * Multiple tags with the same name are merged into a single entry.
 */
function extractConfig(content: string): ConfigEntry[] {
	const jsdocMatch = content.match(/^\/\*\*([\s\S]*?)\*\//)
	if (!jsdocMatch) return []

	const configMap = new Map<string, ConfigEntry>()
	const configRegex = /@config\s+(\S+)\s+(.+)/g
	let match: RegExpExecArray | null

	while ((match = configRegex.exec(jsdocMatch[1]!)) !== null) {
		const name = match[1]!
		const rest = match[2]!.trim()

		// Check if this is an env var binding: @config <name> env <ENV_VAR>
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

		// Field definition: @config <name> <type>[?] - <description>
		const fieldMatch = rest.match(/^(\w+)(\?)?\s*-\s*(.+)$/)
		if (fieldMatch) {
			const existing = configMap.get(name)
			const entry: ConfigEntry = {
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

async function readLibFile(
	libName: string,
	type: "tools" | "agents" = "tools",
): Promise<{ path: string; content: string } | null> {
	const libPath = path.join(SRC_DIR, type, "lib", `${libName}.ts`)

	try {
		const content = await fs.readFile(libPath, "utf-8")
		return {
			path: `${type}/lib/${libName}.ts`,
			content,
		}
	} catch {
		return null
	}
}

async function processFile(
	filePath: string,
	type: "tools" | "agents" | "prompts",
	baseDir: string,
): Promise<RegistryItem | null> {
	const baseName = path.basename(filePath, ".ts")

	// Skip test files and lib directory
	if (
		baseName.endsWith(".test") ||
		filePath.includes("__tests__") ||
		filePath.includes("/lib/")
	) {
		return null
	}

	// Compute the relative path from the type directory for nested items
	// e.g., for tools/figma/fetch.ts -> "figma/fetch"
	const relativePath = path.relative(baseDir, filePath)
	const name = relativePath.replace(/\.ts$/, "")

	const content = await fs.readFile(filePath, "utf-8")
	const {
		npmDeps,
		npmDevDeps,
		registryDeps,
		toolLibFiles,
		agentLibFiles,
		relativeLibFiles,
	} = extractImports(content, { npmPackages: NPM_PACKAGES })
	const description = extractDescription(content, baseName, type)

	const registryType = `registry:${type.slice(0, -1)}` // tools -> registry:tool

	const files: RegistryFile[] = [
		{
			path: `${type}/${name}.ts`,
			type: registryType,
			content,
		},
	]

	// @/tools/lib/* imports - always top-level lib
	for (const libName of toolLibFiles) {
		const libFile = await readLibFile(libName, "tools")
		if (libFile) {
			files.push({
				path: libFile.path,
				type: "registry:lib",
				content: libFile.content,
			})
		}
	}

	// @/agents/lib/* imports - always top-level lib
	for (const libName of agentLibFiles) {
		const libFile = await readLibFile(libName, "agents")
		if (libFile) {
			files.push({
				path: libFile.path,
				type: "registry:lib",
				content: libFile.content,
			})
		}
	}

	// ./lib/* imports - resolve relative to the source file
	const fileDir = path.dirname(filePath)
	for (const libName of relativeLibFiles) {
		const libPath = path.join(fileDir, "lib", `${libName}.ts`)
		const libContent = await fs.readFile(libPath, "utf-8")
		const libRelativePath = path.relative(baseDir, libPath)
		files.push({
			path: `${type}/${libRelativePath}`,
			type: "registry:lib",
			content: libContent,
		})
	}

	const item: RegistryItem = {
		name,
		type: registryType,
		title: toTitleCase(baseName),
		description,
		files,
	}

	if (npmDeps.length > 0) {
		item.dependencies = npmDeps.map(formatDependency)
	}

	if (npmDevDeps.length > 0) {
		item.devDependencies = npmDevDeps.map(formatDependency)
	}

	if (registryDeps.length > 0) {
		item.registryDependencies = registryDeps
	}

	const categories = extractCategories(content)
	if (categories.length > 0) {
		item.categories = categories
	}

	const config = extractConfig(content)
	if (config.length > 0) {
		item.config = config
	}

	return item
}

async function processDirectory(
	type: "tools" | "agents" | "prompts",
): Promise<RegistryItem[]> {
	const baseDir = path.join(SRC_DIR, type)
	const items: RegistryItem[] = []

	async function walkDirectory(dirPath: string): Promise<void> {
		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name)

				if (entry.isDirectory()) {
					if (entry.name === "lib" || entry.name === "__tests__") {
						continue
					}
					await walkDirectory(fullPath)
				} else if (
					entry.isFile() &&
					entry.name.endsWith(".ts") &&
					!entry.name.includes(".test.")
				) {
					const item = await processFile(fullPath, type, baseDir)
					if (item) {
						items.push(item)
					}
				}
			}
		} catch (error) {
			console.warn(`Warning: Could not read directory ${dirPath}:`, error)
		}
	}

	await walkDirectory(baseDir)
	return items
}

async function writeRegistryItem(
	item: RegistryItem,
	type: string,
): Promise<void> {
	// Validate item against schema
	const result = registryItemSchema.safeParse(item)
	if (!result.success) {
		console.error(`  ✗ ${type}/${item.name}.json - validation failed:`)
		for (const error of result.error.issues) {
			console.error(`    - ${error.path.join(".")}: ${error.message}`)
		}
		throw new Error(`Invalid registry item: ${item.name}`)
	}

	const outputPath = path.join(OUTPUT_DIR, type, `${item.name}.json`)
	await fs.mkdir(path.dirname(outputPath), { recursive: true })
	await fs.writeFile(outputPath, `${JSON.stringify(result.data, null, "\t")}\n`)
	console.log(`  ✓ ${type}/${item.name}.json`)
}

async function writeRegistryIndex(
	items: RegistryItem[],
	type: string,
): Promise<void> {
	const index: RegistryIndex = {
		name: `@awesome-ai/${type}`,
		homepage: "https://awesome-ai.com",
		items: items.map((item) => ({
			name: item.name,
			type: item.type,
			title: item.title,
			description: item.description,
			dependencies: item.dependencies,
			registryDependencies: item.registryDependencies,
			categories: item.categories,
			config: item.config,
		})),
	}

	// Validate index against schema
	const result = registryIndexSchema.safeParse(index)
	if (!result.success) {
		console.error(`  ✗ ${type}/registry.json - validation failed:`)
		for (const error of result.error.issues) {
			console.error(`    - ${error.path.join(".")}: ${error.message}`)
		}
		throw new Error(`Invalid registry index for ${type}`)
	}

	// Also create registry.json (used by list command)
	const registryPath = path.join(OUTPUT_DIR, type, "registry.json")
	await fs.mkdir(path.dirname(registryPath), { recursive: true })
	await fs.writeFile(
		registryPath,
		`${JSON.stringify(result.data, null, "\t")}\n`,
	)
	console.log(`  ✓ ${type}/registry.json`)
}

async function main() {
	console.log("Building registry...\n")

	// Load npm packages from package.json
	NPM_PACKAGES = await loadNpmPackages()
	console.log(
		`Detected ${NPM_PACKAGES.size} npm dependencies: ${[...NPM_PACKAGES].join(", ")}\n`,
	)

	// Clean output directory
	await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
	await fs.mkdir(OUTPUT_DIR, { recursive: true })

	const types = ["tools", "agents", "prompts"] as const
	let totalItems = 0
	let totalErrors = 0

	for (const type of types) {
		console.log(`Processing ${type}...`)
		const items = await processDirectory(type)

		for (const item of items) {
			try {
				await writeRegistryItem(item, type)
				totalItems++
			} catch (_error) {
				totalErrors++
				// Continue processing other items
			}
		}

		if (items.length > 0) {
			try {
				await writeRegistryIndex(items, type)
			} catch (_error) {
				totalErrors++
			}
		}

		console.log(`  Found ${items.length} ${type}\n`)
	}

	if (totalErrors > 0) {
		console.error(`\nRegistry build completed with ${totalErrors} error(s).`)
		process.exit(1)
	}

	console.log(`Registry build complete! Generated ${totalItems} items.`)
}

main().catch((error) => {
	console.error("Build failed:", error)
	process.exit(1)
})
