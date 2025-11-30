#!/usr/bin/env node
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

// Zod schemas for validation
const registryFileSchema = z.object({
	path: z.string(),
	type: z.string(),
	content: z.string(),
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

function extractImports(content: string): {
	npmDeps: string[]
	registryDeps: string[]
	libFiles: string[]
} {
	const npmDeps: string[] = []
	const registryDeps: string[] = []
	const libFiles: string[] = []

	// Match import statements
	const importRegex =
		/import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["']/g
	let match = importRegex.exec(content)

	while (match !== null) {
		const importPath = match[1]!

		// Skip relative imports (handled separately for lib files)
		if (importPath.startsWith("./") || importPath.startsWith("../")) {
			match = importRegex.exec(content)
			continue
		}

		// Check for @/ alias imports (registry dependencies)
		if (importPath.startsWith("@/tools/lib/")) {
			// This is a lib file
			const libName = importPath.replace("@/tools/lib/", "")
			libFiles.push(libName)
		} else if (importPath.startsWith("@/tools/")) {
			const toolName = importPath.replace("@/tools/", "")
			registryDeps.push(`tools:${toolName}`)
		} else if (importPath.startsWith("@/prompts/")) {
			const promptName = importPath.replace("@/prompts/", "")
			registryDeps.push(`prompts:${promptName}`)
		} else if (importPath.startsWith("@/agents/")) {
			const agentName = importPath.replace("@/agents/", "")
			registryDeps.push(`agents:${agentName}`)
		} else if (
			!importPath.startsWith("node:") &&
			!importPath.startsWith("@/")
		) {
			// External npm package
			const packageName = importPath.startsWith("@")
				? importPath.split("/").slice(0, 2).join("/")
				: importPath.split("/")[0]!

			if (NPM_PACKAGES.has(packageName)) {
				npmDeps.push(packageName)
			}
		}
		match = importRegex.exec(content)
	}

	return {
		npmDeps: [...new Set(npmDeps)],
		registryDeps: [...new Set(registryDeps)],
		libFiles: [...new Set(libFiles)],
	}
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

async function readLibFile(
	libName: string,
): Promise<{ path: string; content: string } | null> {
	const libPath = path.join(SRC_DIR, "tools/lib", `${libName}.ts`)
	try {
		const content = await fs.readFile(libPath, "utf-8")
		return {
			path: `tools/lib/${libName}.ts`,
			content,
		}
	} catch {
		return null
	}
}

async function processFile(
	filePath: string,
	type: "tools" | "agents" | "prompts",
): Promise<RegistryItem | null> {
	const name = path.basename(filePath, ".ts")

	// Skip test files and lib directory
	if (
		name.endsWith(".test") ||
		filePath.includes("__tests__") ||
		filePath.includes("/lib/")
	) {
		return null
	}

	const content = await fs.readFile(filePath, "utf-8")
	const { npmDeps, registryDeps, libFiles } = extractImports(content)
	const description = extractDescription(content, name, type)

	const registryType = `registry:${type.slice(0, -1)}` // tools -> registry:tool

	const files: RegistryFile[] = [
		{
			path: `${type}/${name}.ts`,
			type: registryType,
			content,
		},
	]

	// Add lib files
	for (const libName of libFiles) {
		const libFile = await readLibFile(libName)
		if (libFile) {
			files.push({
				path: libFile.path,
				type: "registry:lib",
				content: libFile.content,
			})
		}
	}

	const item: RegistryItem = {
		name,
		type: registryType,
		title: toTitleCase(name),
		description,
		files,
	}

	if (npmDeps.length > 0) {
		item.dependencies = npmDeps
	}

	if (registryDeps.length > 0) {
		item.registryDependencies = registryDeps
	}

	return item
}

async function processDirectory(
	type: "tools" | "agents" | "prompts",
): Promise<RegistryItem[]> {
	const dirPath = path.join(SRC_DIR, type)
	const items: RegistryItem[] = []

	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })

		for (const entry of entries) {
			if (
				entry.isFile() &&
				entry.name.endsWith(".ts") &&
				!entry.name.includes(".test.")
			) {
				const filePath = path.join(dirPath, entry.name)
				const item = await processFile(filePath, type)
				if (item) {
					items.push(item)
				}
			}
		}
	} catch (error) {
		console.warn(`Warning: Could not read ${type} directory:`, error)
	}

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
		for (const error of result.error.errors) {
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
		})),
	}

	// Validate index against schema
	const result = registryIndexSchema.safeParse(index)
	if (!result.success) {
		console.error(`  ✗ ${type}/registry.json - validation failed:`)
		for (const error of result.error.errors) {
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
