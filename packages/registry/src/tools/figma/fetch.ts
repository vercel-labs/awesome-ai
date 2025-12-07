import { promises as fs } from "node:fs"
import * as path from "node:path"
import { tool } from "ai"
import { z } from "zod"
import { extractFigmaStructure } from "./lib/parser"
import type {
	ComponentState,
	ExtractedData,
	FigmaFile,
	MigrationState,
	PageState,
} from "./lib/types"

const FIGMA_API_BASE = "https://api.figma.com/v1"
const MIGRATION_FILE = ".figma-migration.json"

let currentProjectDir: string | null = null

export function setProjectDir(dir: string): void {
	currentProjectDir = dir
}

export function getProjectDir(): string {
	return currentProjectDir || process.cwd()
}

function parseFileKeyFromUrl(urlOrKey: string): string {
	if (!urlOrKey.includes("/")) {
		return urlOrKey
	}

	const patterns = [
		/figma\.com\/file\/([a-zA-Z0-9]+)/,
		/figma\.com\/design\/([a-zA-Z0-9]+)/,
	]

	for (const pattern of patterns) {
		const match = urlOrKey.match(pattern)
		if (match?.[1]) {
			return match[1]
		}
	}

	return urlOrKey
}

async function fetchFigmaFile(
	fileKey: string,
	token: string,
): Promise<FigmaFile> {
	const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
		headers: {
			"X-Figma-Token": token,
		},
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(
			`Figma API error (${response.status}): ${errorText || response.statusText}`,
		)
	}

	return response.json() as Promise<FigmaFile>
}

function buildComponentDependencies(
	data: ExtractedData,
): Map<string, Set<string>> {
	const deps = new Map<string, Set<string>>()

	for (const [compId, compData] of Object.entries(data.components)) {
		const compDeps = new Set<string>()
		if (compData.definition?.children) {
			findInstanceDependencies(compData.definition.children, compDeps, compId)
		}
		deps.set(compId, compDeps)
	}

	return deps
}

function findInstanceDependencies(
	nodes: ExtractedData["components"][string]["definition"][],
	deps: Set<string>,
	selfId: string,
): void {
	for (const node of nodes) {
		if (!node) continue
		if (
			node.type === "INSTANCE" &&
			node.componentId &&
			node.componentId !== selfId
		) {
			deps.add(node.componentId)
		}
		if (node.children) {
			findInstanceDependencies(node.children, deps, selfId)
		}
	}
}

function createMigrationState(
	data: ExtractedData,
	fileKey: string,
	fileUrl: string,
): MigrationState {
	const componentDeps = buildComponentDependencies(data)

	const components: Record<string, ComponentState> = {}
	for (const [compId, compData] of Object.entries(data.components)) {
		const deps = Array.from(componentDeps.get(compId) || [])
		components[compId] = {
			figmaId: compId,
			name: compData.name,
			status: "pending",
			dependencies: deps,
			dependenciesReady: deps.length === 0,
			instanceCount: compData.instanceCount,
		}
	}

	const pages: Record<string, PageState> = {}
	for (const [frameId, frameData] of Object.entries(data.frames)) {
		pages[frameId] = {
			figmaId: frameId,
			frameName: frameData.name,
			status: "blocked",
			componentsUsed: frameData.componentsUsed,
			componentsReady: false,
		}
	}

	// Update dependency readiness
	const doneOrSkipped = new Set<string>()
	for (const comp of Object.values(components)) {
		comp.dependenciesReady =
			comp.dependencies.length === 0 ||
			comp.dependencies.every((dep) => doneOrSkipped.has(dep))
	}
	for (const page of Object.values(pages)) {
		page.componentsReady = page.componentsUsed.every((compId) =>
			doneOrSkipped.has(compId),
		)
		if (page.status === "blocked" && page.componentsReady) {
			page.status = "pending"
		}
	}

	return {
		figmaFileKey: fileKey,
		figmaFileUrl: fileUrl,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		stats: {
			totalComponents: Object.keys(components).length,
			completedComponents: 0,
			skippedComponents: 0,
			totalPages: Object.keys(pages).length,
			completedPages: 0,
			phase: "components",
		},
		components,
		pages,
		figmaData: data,
	}
}

const description = `Fetch a Figma file and initialize the migration.

This tool:
1. Fetches the Figma file from the Figma REST API
2. Extracts and processes all components and frames
3. Creates the migration state file (.figma-migration.json)
4. Returns the components ready to be migrated

Input can be either:
- A Figma file key (e.g., "abc123XYZ")
- A full Figma URL (e.g., "https://www.figma.com/file/abc123XYZ/My-Design")

After this, use migrationStart to begin working on components.`

export function createFigmaFetchTool(figmaToken?: string) {
	return tool({
		description,
		inputSchema: z.object({
			fileKeyOrUrl: z
				.string()
				.describe("The Figma file key or full URL to fetch"),
			skipInvisible: z
				.boolean()
				.default(true)
				.describe("Skip invisible nodes in the design"),
		}),
		outputSchema: z.union([
			z.object({
				status: z.literal("pending"),
				message: z.string(),
			}),
			z.object({
				status: z.literal("success"),
				message: z.string(),
				fileKey: z.string(),
				totalComponents: z.number(),
				totalPages: z.number(),
				readyComponents: z.array(
					z.object({
						id: z.string(),
						name: z.string(),
						instanceCount: z.number(),
					}),
				),
			}),
			z.object({
				status: z.literal("error"),
				message: z.string(),
				error: z.string(),
			}),
		]),
		toModelOutput: (output) => {
			if (output.status === "error") {
				return {
					type: "error-text",
					value: output.error,
				}
			}
			if (output.status === "pending") {
				return { type: "text", value: output.message }
			}

			const readyList = output.readyComponents
				.slice(0, 10)
				.map((c) => `  - ${c.name} (id: ${c.id}, ${c.instanceCount}x)`)
				.join("\n")

			return {
				type: "text",
				value: `Migration initialized for ${output.fileKey}

${output.totalComponents} components, ${output.totalPages} pages

Ready to start (${output.readyComponents.length} components with no dependencies):
${readyList}${output.readyComponents.length > 10 ? `\n  ... and ${output.readyComponents.length - 10} more` : ""}

Use migrationStart with a component id to begin.`,
			}
		},
		async *execute({ fileKeyOrUrl, skipInvisible }) {
			const token = figmaToken || process.env.FIGMA_TOKEN

			if (!token) {
				yield {
					status: "error",
					message: "No Figma token provided",
					error:
						"FIGMA_TOKEN environment variable is not set. Please set it to your Figma personal access token.",
				}
				return
			}

			const fileKey = parseFileKeyFromUrl(fileKeyOrUrl)

			yield {
				status: "pending",
				message: `Fetching Figma file ${fileKey}...`,
			}

			try {
				const fileData = await fetchFigmaFile(fileKey, token)
				const extracted = extractFigmaStructure(fileData, { skipInvisible })

				// Create migration state and save to disk
				const state = createMigrationState(extracted, fileKey, fileKeyOrUrl)
				const filepath = path.join(getProjectDir(), MIGRATION_FILE)
				await fs.writeFile(filepath, JSON.stringify(state, null, 2))

				// Find ready components (no dependencies)
				const readyComponents = Object.values(state.components)
					.filter((c) => c.status === "pending" && c.dependenciesReady)
					.sort((a, b) => b.instanceCount - a.instanceCount)
					.map((c) => ({
						id: c.figmaId,
						name: c.name,
						instanceCount: c.instanceCount,
					}))

				yield {
					status: "success",
					message: "Migration initialized",
					fileKey,
					totalComponents: state.stats.totalComponents,
					totalPages: state.stats.totalPages,
					readyComponents,
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Failed to fetch Figma file",
					error: error instanceof Error ? error.message : String(error),
				}
			}
		},
	})
}
