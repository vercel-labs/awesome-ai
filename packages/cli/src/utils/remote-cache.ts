import { createHash } from "crypto"
import { execa } from "execa"
import { promises as fs } from "fs"
import { homedir } from "os"
import path from "path"
import { configWithDefaults } from "../registry/config"
import { resolveRegistryTree } from "../registry/resolver"
import type { RegistryItemCategory } from "../registry/schema"
import { getRelativePath, getTargetDir } from "./file-type"

const APP_NAME = "awesome-ai"

async function readFile(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf-8")
	} catch {
		return null
	}
}

function getLocalCachePath() {
	const xdgCache = process.env.XDG_CACHE_HOME || path.join(homedir(), ".cache")
	return path.join(xdgCache, APP_NAME, "local")
}

function getCacheConfig() {
	const cachePath = getLocalCachePath()
	return configWithDefaults({
		resolvedPaths: {
			cwd: cachePath,
			agents: path.join(cachePath, "agents"),
			tools: path.join(cachePath, "tools"),
			prompts: path.join(cachePath, "prompts"),
		},
	})
}

function getContentHash(content: string) {
	return createHash("sha256").update(content).digest("hex").slice(0, 16)
}

export interface SyncItem {
	name: string
	type: RegistryItemCategory
	isNew: boolean
}

export interface SyncPlan {
	toSync: SyncItem[]
	dependencies: string[]
	devDependencies: string[]
	needsSync: boolean
}

export interface PreparedSync {
	plan: SyncPlan
	/** Execute the sync. Only call if user approved and `plan.needsSync` is true. */
	sync: () => Promise<void>
}

/**
 * Prepare a sync operation: fetch registry items, determine what needs syncing,
 * and return a function to execute the sync.
 */
export async function prepareSync(
	items: Array<{ name: string; type: RegistryItemCategory }>,
): Promise<PreparedSync> {
	const cachePath = getLocalCachePath()
	const config = getCacheConfig()

	type ResolvedTree = Awaited<ReturnType<typeof resolveRegistryTree>>
	interface FetchedItem {
		item: { name: string; type: RegistryItemCategory }
		tree: ResolvedTree | null
	}

	// Fetch all items in parallel
	const fetched: FetchedItem[] = await Promise.all(
		items.map(async (item) => {
			try {
				const tree = await resolveRegistryTree([item.name], item.type, config)
				return { item, tree }
			} catch {
				return { item, tree: null }
			}
		}),
	)

	const allDeps = new Set<string>()
	const allDevDeps = new Set<string>()

	// Check all items in parallel
	const syncChecks = await Promise.all(
		fetched.map(async ({ item, tree }): Promise<SyncItem | null> => {
			if (!tree?.files?.length) return null

			for (const dep of tree.dependencies ?? []) allDeps.add(dep)
			for (const dep of tree.devDependencies ?? []) allDevDeps.add(dep)

			// Check if cached version exists and matches
			const mainFile = tree.files.find(
				(f) =>
					f.path === `${item.type}/${item.name}.ts` ||
					f.path === `${item.type}/${item.name}.tsx`,
			)

			if (!mainFile) return null

			const ext = mainFile.path.endsWith(".tsx") ? ".tsx" : ".ts"
			const cachedItemPath = path.join(
				cachePath,
				item.type,
				`${item.name}${ext}`,
			)

			const mainContent = await readFile(cachedItemPath)
			if (mainContent === null) {
				return { name: item.name, type: item.type, isNew: true }
			}

			// Compare all files for this item in parallel
			const fileChecks = await Promise.all(
				tree.files.map(async (file) => {
					const relativePath = getRelativePath(file.path)
					const fileCachedPath = path.join(cachePath, item.type, relativePath)

					const cachedContent = await readFile(fileCachedPath)
					if (cachedContent === null) return true // needs update

					return getContentHash(cachedContent) !== getContentHash(file.content)
				}),
			)

			const needsUpdate = fileChecks.some((changed) => changed)
			if (needsUpdate) {
				return { name: item.name, type: item.type, isNew: false }
			}

			return null
		}),
	)

	const toSync = syncChecks.filter((item): item is SyncItem => item !== null)

	const plan: SyncPlan = {
		toSync,
		dependencies: Array.from(allDeps),
		devDependencies: Array.from(allDevDeps),
		needsSync: toSync.length > 0,
	}

	// Return plan and a sync function that reuses the fetched data
	const sync = async () => {
		// Ensure directories exist
		await Promise.all([
			fs.mkdir(path.join(cachePath, "agents"), { recursive: true }),
			fs.mkdir(path.join(cachePath, "tools"), { recursive: true }),
			fs.mkdir(path.join(cachePath, "prompts"), { recursive: true }),
		])

		// Filter to only items that need syncing
		const itemsToSyncSet = new Set(toSync.map((i) => `${i.type}:${i.name}`))
		const toWrite = fetched.filter((f) =>
			itemsToSyncSet.has(`${f.item.type}:${f.item.name}`),
		)

		// Collect all file writes
		const fileWrites: Array<{ filePath: string; content: string }> = []

		for (const { item, tree } of toWrite) {
			if (!tree?.files.length) continue

			for (const file of tree.files) {
				const targetDir = getTargetDir(file, item.type)
				const relativePath = getRelativePath(file.path)
				const filePath = path.join(cachePath, targetDir, relativePath)

				fileWrites.push({ filePath, content: file.content })
			}
		}

		await Promise.all(
			fileWrites.map(async ({ filePath, content }) => {
				await fs.mkdir(path.dirname(filePath), { recursive: true })
				await fs.writeFile(filePath, content, "utf-8")
			}),
		)

		await updateCachePackageJson(Array.from(allDeps), Array.from(allDevDeps))
	}

	return { plan, sync }
}

async function updateCachePackageJson(deps: string[], devDeps: string[]) {
	if (deps.length === 0 && devDeps.length === 0) return

	const cachePath = getLocalCachePath()
	const packageJsonPath = path.join(cachePath, "package.json")

	let packageJson: Record<string, unknown> = {
		name: "awesome-ai-local-cache",
		version: "0.0.0",
		private: true,
		type: "module",
	}

	const existing = await readFile(packageJsonPath)
	if (existing) {
		try {
			packageJson = JSON.parse(existing)
		} catch {
			// Use default if parsing fails
		}
	}

	const existingDeps = (packageJson.dependencies || {}) as Record<
		string,
		string
	>
	const existingDevDeps = (packageJson.devDependencies || {}) as Record<
		string,
		string
	>

	for (const dep of deps) {
		const [name, version] = parseDependency(dep)
		existingDeps[name] = version
	}

	for (const dep of devDeps) {
		const [name, version] = parseDependency(dep)
		existingDevDeps[name] = version
	}

	packageJson.dependencies = existingDeps
	packageJson.devDependencies = existingDevDeps

	await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
}

function parseDependency(dep: string): [string, string] {
	if (dep.startsWith("@")) {
		const match = dep.match(/^(@[^@]+)@(.+)$/)
		if (match?.[1] && match[2]) return [match[1], match[2]]
		return [dep, "latest"]
	}

	const atIndex = dep.lastIndexOf("@")
	if (atIndex > 0) {
		return [dep.slice(0, atIndex), dep.slice(atIndex + 1)]
	}

	return [dep, "latest"]
}

export async function installCacheDependencies(
	options: { silent?: boolean } = {},
) {
	const cachePath = getLocalCachePath()
	const packageJsonPath = path.join(cachePath, "package.json")

	const content = await readFile(packageJsonPath)
	if (!content) return

	await execa("bun", ["install"], {
		cwd: cachePath,
		stdio: options.silent ? "pipe" : "inherit",
	})
}

export function getCachedItemsPaths() {
	const cachePath = getLocalCachePath()
	return {
		agents: path.join(cachePath, "agents"),
		tools: path.join(cachePath, "tools"),
		prompts: path.join(cachePath, "prompts"),
	}
}
