import { promises as fs } from "node:fs"
import * as path from "node:path"
import { tool } from "ai"
import { z } from "zod"
import { getProjectDir } from "./fetch"
import type {
	MigrationNextItem,
	MigrationPhase,
	MigrationProgressResult,
	MigrationState,
	MigrationStats,
} from "./lib/types"

const MIGRATION_FILE = ".figma-migration.json"

async function readMigrationState(
	projectDir?: string,
): Promise<MigrationState | null> {
	const cwd = projectDir || getProjectDir()
	try {
		const filepath = path.join(cwd, MIGRATION_FILE)
		const content = await fs.readFile(filepath, "utf-8")
		return JSON.parse(content)
	} catch {
		return null
	}
}

async function writeMigrationState(
	state: MigrationState,
	projectDir?: string,
): Promise<void> {
	const cwd = projectDir || getProjectDir()
	const filepath = path.join(cwd, MIGRATION_FILE)
	state.updatedAt = new Date().toISOString()
	await fs.writeFile(filepath, JSON.stringify(state, null, 2))
}

function computeStats(state: MigrationState): MigrationStats {
	const components = Object.values(state.components)
	const pages = Object.values(state.pages)

	const completedComponents = components.filter(
		(c) => c.status === "done",
	).length
	const skippedComponents = components.filter(
		(c) => c.status === "skipped",
	).length
	const completedPages = pages.filter((p) => p.status === "done").length

	const allComponentsDone =
		completedComponents + skippedComponents === components.length
	const allPagesDone = completedPages === pages.length

	let phase: MigrationPhase = "components"
	if (allComponentsDone && !allPagesDone) {
		phase = "pages"
	} else if (allComponentsDone && allPagesDone) {
		phase = "done"
	}

	return {
		totalComponents: components.length,
		completedComponents,
		skippedComponents,
		totalPages: pages.length,
		completedPages,
		phase,
	}
}

function updateDependencyReadiness(state: MigrationState): void {
	const doneOrSkipped = new Set(
		Object.values(state.components)
			.filter((c) => c.status === "done" || c.status === "skipped")
			.map((c) => c.figmaId),
	)

	for (const comp of Object.values(state.components)) {
		comp.dependenciesReady =
			comp.dependencies.length === 0 ||
			comp.dependencies.every((dep) => doneOrSkipped.has(dep))
	}

	for (const page of Object.values(state.pages)) {
		page.componentsReady = page.componentsUsed.every((compId) =>
			doneOrSkipped.has(compId),
		)
		if (page.status === "blocked" && page.componentsReady) {
			page.status = "pending"
		}
	}
}

// ============================================================================
// Tool: migrationProgress
// ============================================================================

const progressDescription = `Get the current migration progress.

Returns:
- Current phase (components or pages)
- Counts for completed, in-progress, and pending items
- Current task being worked on (if any)
- Next items that will be ready

Use this to check overall progress.`

export const migrationProgress = tool({
	description: progressDescription,
	inputSchema: z.object({}),
	outputSchema: z.union([
		z.object({
			status: z.literal("pending"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("success"),
			message: z.string(),
			progress: z.object({
				phase: z.string(),
				components: z.object({
					total: z.number(),
					done: z.number(),
					inProgress: z.number(),
					pending: z.number(),
					skipped: z.number(),
				}),
				pages: z.object({
					total: z.number(),
					done: z.number(),
					ready: z.number(),
					blocked: z.number(),
				}),
				currentTask: z.string().optional(),
				nextUp: z.array(z.string()),
			}),
		}),
		z.object({
			status: z.literal("error"),
			message: z.string(),
			error: z.string(),
		}),
	]),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return { type: "error-text", value: output.error }
		}
		if (output.status === "pending") {
			return { type: "text", value: output.message }
		}
		const { progress } = output
		const lines = [
			`Phase: ${progress.phase}`,
			"",
			"Components:",
			`  Done: ${progress.components.done}/${progress.components.total}`,
			`  In Progress: ${progress.components.inProgress}`,
			`  Pending: ${progress.components.pending}`,
			`  Skipped: ${progress.components.skipped}`,
			"",
			"Pages:",
			`  Done: ${progress.pages.done}/${progress.pages.total}`,
			`  Ready: ${progress.pages.ready}`,
			`  Blocked: ${progress.pages.blocked}`,
		]
		if (progress.currentTask) {
			lines.push("", `Current: ${progress.currentTask}`)
		}
		if (progress.nextUp.length > 0) {
			lines.push("", `Next up: ${progress.nextUp.join(", ")}`)
		}
		return { type: "text", value: lines.join("\n") }
	},
	async *execute() {
		yield {
			status: "pending",
			message: "Reading migration progress...",
		}

		const state = await readMigrationState()

		if (!state) {
			yield {
				status: "error",
				message: "No migration found",
				error: "No migration state found. Use figmaFetch first.",
			}
			return
		}

		const components = Object.values(state.components)
		const pages = Object.values(state.pages)

		const inProgress = components.find((c) => c.status === "in_progress")
		const inProgressPage = pages.find((p) => p.status === "in_progress")

		const readyComponents = components
			.filter((c) => c.status === "pending" && c.dependenciesReady)
			.sort((a, b) => b.instanceCount - a.instanceCount)

		const readyPages = pages.filter(
			(p) => p.status === "pending" && p.componentsReady,
		)

		let nextUp: string[] = []
		if (state.stats.phase === "components") {
			nextUp = readyComponents.slice(0, 3).map((c) => c.name)
		} else if (state.stats.phase === "pages") {
			nextUp = readyPages.slice(0, 3).map((p) => p.frameName)
		}

		const progress: MigrationProgressResult = {
			phase: state.stats.phase,
			components: {
				total: components.length,
				done: components.filter((c) => c.status === "done").length,
				inProgress: components.filter((c) => c.status === "in_progress").length,
				pending: components.filter((c) => c.status === "pending").length,
				skipped: components.filter((c) => c.status === "skipped").length,
			},
			pages: {
				total: pages.length,
				done: pages.filter((p) => p.status === "done").length,
				ready: readyPages.length,
				blocked: pages.filter((p) => p.status === "blocked").length,
			},
			currentTask: inProgress?.name || inProgressPage?.frameName,
			nextUp,
		}

		yield {
			status: "success",
			message: "Progress retrieved",
			progress,
		}
	},
})

// ============================================================================
// Tool: migrationNext
// ============================================================================

const nextDescription = `Get the next items ready to be migrated.

Returns items that:
- For components: Have all dependencies completed
- For pages: Have all required components completed

Items are sorted by priority (instance count for components).`

export const migrationNext = tool({
	description: nextDescription,
	inputSchema: z.object({
		limit: z.number().default(5).describe("Maximum number of items to return"),
		type: z
			.enum(["component", "page", "any"])
			.default("any")
			.describe("Filter by item type"),
	}),
	outputSchema: z.union([
		z.object({
			status: z.literal("pending"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("success"),
			message: z.string(),
			phase: z.string(),
			items: z.array(
				z.object({
					type: z.enum(["component", "page"]),
					id: z.string(),
					name: z.string(),
					instanceCount: z.number().optional(),
					dependencies: z.array(z.string()).optional(),
					componentsUsed: z.array(z.string()).optional(),
				}),
			),
			remaining: z.number(),
		}),
		z.object({
			status: z.literal("error"),
			message: z.string(),
			error: z.string(),
		}),
	]),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return { type: "error-text", value: output.error }
		}
		if (output.status === "pending") {
			return { type: "text", value: output.message }
		}
		if (output.items.length === 0) {
			return {
				type: "text",
				value:
					output.phase === "done"
						? "Migration complete! All items have been processed."
						: "No items ready. Some items may be blocked by dependencies.",
			}
		}
		const lines = output.items.map((item) => {
			if (item.type === "component") {
				const deps = item.dependencies?.length
					? ` (deps: ${item.dependencies.length})`
					: ""
				return `- [component] ${item.name} (${item.instanceCount}x)${deps}`
			}
			return `- [page] ${item.name} (${item.componentsUsed?.length || 0} components)`
		})
		lines.push("", `${output.remaining} more items remaining`)
		return { type: "text", value: lines.join("\n") }
	},
	async *execute({ limit, type }) {
		yield {
			status: "pending",
			message: "Finding next items...",
		}

		const state = await readMigrationState()

		if (!state) {
			yield {
				status: "error",
				message: "No migration found",
				error: "No migration state found. Use figmaFetch first.",
			}
			return
		}

		const items: MigrationNextItem[] = []

		if (type === "any" || type === "component") {
			const readyComponents = Object.values(state.components)
				.filter((c) => c.status === "pending" && c.dependenciesReady)
				.sort((a, b) => b.instanceCount - a.instanceCount)

			for (const comp of readyComponents) {
				items.push({
					type: "component",
					id: comp.figmaId,
					name: comp.name,
					instanceCount: comp.instanceCount,
					dependencies: comp.dependencies,
				})
			}
		}

		if ((type === "any" && state.stats.phase === "pages") || type === "page") {
			const readyPages = Object.values(state.pages).filter(
				(p) => p.status === "pending" && p.componentsReady,
			)

			for (const page of readyPages) {
				items.push({
					type: "page",
					id: page.figmaId,
					name: page.frameName,
					componentsUsed: page.componentsUsed,
				})
			}
		}

		const remaining = items.length - limit
		const limited = items.slice(0, limit)

		yield {
			status: "success",
			message: `Found ${items.length} ready items`,
			phase: state.stats.phase,
			items: limited,
			remaining: Math.max(0, remaining),
		}
	},
})

// ============================================================================
// Tool: migrationStart
// ============================================================================

const startDescription = `Start working on a migration item.

Returns the full Figma definition needed to implement the component or page.
After implementing, call migrationComplete to mark it done.`

export const migrationStart = tool({
	description: startDescription,
	inputSchema: z.object({
		id: z.string().describe("The component or page ID to start working on"),
	}),
	outputSchema: z.union([
		z.object({
			status: z.literal("pending"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("success"),
			message: z.string(),
			type: z.enum(["component", "page"]),
			id: z.string(),
			name: z.string(),
			definition: z.any(),
			suggestedPath: z.string(),
			dependencies: z.array(z.string()).optional(),
		}),
		z.object({
			status: z.literal("error"),
			message: z.string(),
			error: z.string(),
		}),
	]),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return { type: "error-text", value: output.error }
		}
		if (output.status === "pending") {
			return { type: "text", value: output.message }
		}
		return {
			type: "text",
			value: JSON.stringify(output.definition, null, 2),
		}
	},
	async *execute({ id }) {
		yield {
			status: "pending",
			message: `Starting work on ${id}...`,
		}

		const state = await readMigrationState()

		if (!state) {
			yield {
				status: "error",
				message: "No migration found",
				error: "No migration state found. Use figmaFetch first.",
			}
			return
		}

		const component = state.components[id]
		if (component) {
			if (component.status === "done" || component.status === "skipped") {
				yield {
					status: "error",
					message: "Already processed",
					error: `Component ${component.name} is already ${component.status}.`,
				}
				return
			}

			if (!component.dependenciesReady) {
				yield {
					status: "error",
					message: "Dependencies not ready",
					error: `Component ${component.name} has unfinished dependencies: ${component.dependencies.join(", ")}`,
				}
				return
			}

			component.status = "in_progress"
			await writeMigrationState(state)

			const compData = state.figmaData.components[id]
			const safeName = component.name.replace(/[^a-zA-Z0-9]/g, "")

			yield {
				status: "success",
				message: `Started component: ${component.name}`,
				type: "component",
				id,
				name: component.name,
				definition: compData?.definition || null,
				suggestedPath: `src/components/${safeName}.tsx`,
				dependencies: component.dependencies,
			}
			return
		}

		const page = state.pages[id]
		if (page) {
			if (page.status === "done") {
				yield {
					status: "error",
					message: "Already processed",
					error: `Page ${page.frameName} is already done.`,
				}
				return
			}

			if (!page.componentsReady) {
				yield {
					status: "error",
					message: "Components not ready",
					error: `Page ${page.frameName} has unfinished components.`,
				}
				return
			}

			page.status = "in_progress"
			await writeMigrationState(state)

			const frame = state.figmaData.frames[id]
			const safeName = page.frameName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")

			yield {
				status: "success",
				message: `Started page: ${page.frameName}`,
				type: "page",
				id,
				name: page.frameName,
				definition: frame?.definition || null,
				suggestedPath: `src/app/${safeName}/page.tsx`,
			}
			return
		}

		yield {
			status: "error",
			message: "Item not found",
			error: `No component or page found with ID: ${id}`,
		}
	},
})

// ============================================================================
// Tool: migrationComplete
// ============================================================================

const completeDescription = `Mark a migration item as complete.

Records the output path and updates dependency status for other items.
Returns newly unlocked items.`

export const migrationComplete = tool({
	description: completeDescription,
	inputSchema: z.object({
		id: z.string().describe("The component or page ID that was completed"),
		outputPath: z.string().describe("The file path where the item was written"),
	}),
	outputSchema: z.union([
		z.object({
			status: z.literal("pending"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("success"),
			message: z.string(),
			completed: z.string(),
			newReady: z.array(z.string()),
			progress: z.object({
				done: z.number(),
				total: z.number(),
			}),
		}),
		z.object({
			status: z.literal("error"),
			message: z.string(),
			error: z.string(),
		}),
	]),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return { type: "error-text", value: output.error }
		}
		if (output.status === "pending") {
			return { type: "text", value: output.message }
		}
		const lines = [
			`Completed: ${output.completed}`,
			`Progress: ${output.progress.done}/${output.progress.total}`,
		]
		if (output.newReady.length > 0) {
			lines.push(`Newly ready: ${output.newReady.join(", ")}`)
		}
		return { type: "text", value: lines.join("\n") }
	},
	async *execute({ id, outputPath }) {
		yield {
			status: "pending",
			message: `Marking ${id} as complete...`,
		}

		const state = await readMigrationState()

		if (!state) {
			yield {
				status: "error",
				message: "No migration found",
				error: "No migration state found.",
			}
			return
		}

		const component = state.components[id]
		if (component) {
			const wasNotReady = Object.values(state.components)
				.filter((c) => c.status === "pending" && !c.dependenciesReady)
				.map((c) => c.figmaId)

			component.status = "done"
			component.outputPath = outputPath
			component.completedAt = new Date().toISOString()

			updateDependencyReadiness(state)
			state.stats = computeStats(state)
			await writeMigrationState(state)

			const newlyReady = Object.values(state.components)
				.filter(
					(c) =>
						c.status === "pending" &&
						c.dependenciesReady &&
						wasNotReady.includes(c.figmaId),
				)
				.map((c) => c.name)

			yield {
				status: "success",
				message: `Completed component: ${component.name}`,
				completed: component.name,
				newReady: newlyReady,
				progress: {
					done: state.stats.completedComponents,
					total: state.stats.totalComponents,
				},
			}
			return
		}

		const page = state.pages[id]
		if (page) {
			page.status = "done"
			page.outputPath = outputPath
			page.completedAt = new Date().toISOString()

			state.stats = computeStats(state)
			await writeMigrationState(state)

			yield {
				status: "success",
				message: `Completed page: ${page.frameName}`,
				completed: page.frameName,
				newReady: [],
				progress: {
					done: state.stats.completedPages,
					total: state.stats.totalPages,
				},
			}
			return
		}

		yield {
			status: "error",
			message: "Item not found",
			error: `No component or page found with ID: ${id}`,
		}
	},
})

// ============================================================================
// Tool: migrationSkip
// ============================================================================

const skipDescription = `Skip a migration item (for external/existing components).

Skipped items are treated as "done" for dependency purposes.`

export const migrationSkip = tool({
	description: skipDescription,
	inputSchema: z.object({
		id: z.string().describe("The component or page ID to skip"),
		reason: z
			.string()
			.describe("Reason for skipping (e.g., 'external component')"),
	}),
	outputSchema: z.union([
		z.object({
			status: z.literal("pending"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("success"),
			message: z.string(),
			skipped: z.string(),
			reason: z.string(),
			newReady: z.array(z.string()),
		}),
		z.object({
			status: z.literal("error"),
			message: z.string(),
			error: z.string(),
		}),
	]),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return { type: "error-text", value: output.error }
		}
		if (output.status === "pending") {
			return { type: "text", value: output.message }
		}
		const lines = [`Skipped: ${output.skipped}`, `Reason: ${output.reason}`]
		if (output.newReady.length > 0) {
			lines.push(`Newly ready: ${output.newReady.join(", ")}`)
		}
		return { type: "text", value: lines.join("\n") }
	},
	async *execute({ id, reason }) {
		yield {
			status: "pending",
			message: `Skipping ${id}...`,
		}

		const state = await readMigrationState()

		if (!state) {
			yield {
				status: "error",
				message: "No migration found",
				error: "No migration state found.",
			}
			return
		}

		const component = state.components[id]
		if (component) {
			const wasNotReady = Object.values(state.components)
				.filter((c) => c.status === "pending" && !c.dependenciesReady)
				.map((c) => c.figmaId)

			component.status = "skipped"
			component.skipReason = reason
			component.completedAt = new Date().toISOString()

			updateDependencyReadiness(state)
			state.stats = computeStats(state)
			await writeMigrationState(state)

			const newlyReady = Object.values(state.components)
				.filter(
					(c) =>
						c.status === "pending" &&
						c.dependenciesReady &&
						wasNotReady.includes(c.figmaId),
				)
				.map((c) => c.name)

			yield {
				status: "success",
				message: `Skipped component: ${component.name}`,
				skipped: component.name,
				reason,
				newReady: newlyReady,
			}
			return
		}

		const page = state.pages[id]
		if (page) {
			yield {
				status: "error",
				message: "Cannot skip pages",
				error: "Pages cannot be skipped, only components.",
			}
			return
		}

		yield {
			status: "error",
			message: "Item not found",
			error: `No component found with ID: ${id}`,
		}
	},
})
