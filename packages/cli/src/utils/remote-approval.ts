import prompts from "prompts"
import type { RegistryItemCategory } from "../registry/schema"
import { highlighter } from "./highlighter"
import { logger } from "./logger"
import {
	installCacheDependencies,
	prepareSync,
	type SyncPlan,
} from "./remote-cache"
import { spinner } from "./spinner"

interface SyncOptions {
	yes?: boolean
	silent?: boolean
}

/**
 * Display the sync plan and ask for user approval
 * Returns true if approved, false if rejected
 */
async function showRemoteApproval(
	syncPlan: SyncPlan,
	options: SyncOptions = {},
): Promise<boolean> {
	if (options.yes) return true

	if (!syncPlan.needsSync) {
		if (!options.silent) {
			logger.info("All remote items are already cached and up-to-date.")
		}
		return true
	}

	const toDownload = syncPlan.toSync.filter((i) => i.isNew)
	const toUpdate = syncPlan.toSync.filter((i) => !i.isNew)

	logger.break()
	logger.info(highlighter.info("Remote Registry Sync"))
	logger.break()

	if (toDownload.length > 0) {
		logger.info(
			highlighter.success(`New items to download (${toDownload.length}):`),
		)
		for (const item of toDownload) {
			const typeLabel = item.type.slice(0, -1) // "agents" -> "agent"
			logger.info(
				`  ${highlighter.success("+")} ${item.name} ${highlighter.dim(`(${typeLabel})`)}`,
			)
		}
		logger.break()
	}

	if (toUpdate.length > 0) {
		logger.info(
			highlighter.warn(`Items with updates available (${toUpdate.length}):`),
		)
		for (const item of toUpdate) {
			const typeLabel = item.type.slice(0, -1)
			logger.info(
				`  ${highlighter.warn("~")} ${item.name} ${highlighter.dim(`(${typeLabel})`)}`,
			)
		}
		logger.break()
	}

	const totalDeps =
		syncPlan.dependencies.length + syncPlan.devDependencies.length
	if (totalDeps > 0) {
		logger.info(
			`Dependencies to install: ${highlighter.info(String(totalDeps))}`,
		)
		if (syncPlan.dependencies.length <= 10) {
			logger.info(`  ${highlighter.dim(syncPlan.dependencies.join(", "))}`)
		}
		logger.break()
	}

	const { proceed } = await prompts({
		type: "confirm",
		name: "proceed",
		message: "Proceed with sync?",
		initial: true,
	})

	return proceed === true
}

/**
 * Display a compact summary of what was synced
 */
function showSyncComplete(syncPlan: SyncPlan, options: SyncOptions = {}) {
	if (options.silent) return

	const downloaded = syncPlan.toSync.filter((i) => i.isNew).length
	const updated = syncPlan.toSync.filter((i) => !i.isNew).length

	if (downloaded > 0 || updated > 0) {
		const parts: string[] = []
		if (downloaded > 0) parts.push(`${downloaded} downloaded`)
		if (updated > 0) parts.push(`${updated} updated`)
		logger.success(`Remote sync complete: ${parts.join(", ")}`)
	}
}

/**
 * Display error message when sync fails
 */
function showSyncError(error: unknown, options: SyncOptions = {}) {
	if (options.silent) return
	const message = error instanceof Error ? error.message : String(error)
	logger.error(`Remote sync failed: ${message}`)
}

interface PerformSyncResult {
	/** Whether sync was approved and completed (or nothing to sync) */
	success: boolean
	/** Whether user cancelled the sync */
	cancelled: boolean
	/** The sync plan that was computed */
	plan: SyncPlan
}

/**
 * Unified function to handle the entire remote sync workflow:
 * 1. Prepare sync (fetch registry, determine what needs syncing)
 * 2. Show approval prompt
 * 3. Execute sync (reusing fetched data)
 * 4. Install dependencies
 */
export async function performRemoteSync(
	items: Array<{ name: string; type: RegistryItemCategory }>,
	options: SyncOptions = {},
): Promise<PerformSyncResult> {
	// 1. Prepare sync (fetches registry and returns sync function)
	const { plan, sync } = await prepareSync(items)

	// 2. Show approval prompt
	const approved = await showRemoteApproval(plan, options)

	if (!approved) {
		return { success: false, cancelled: true, plan }
	}

	// 3. If nothing to sync, we're done
	if (!plan.needsSync) {
		return { success: true, cancelled: false, plan }
	}

	// 4. Execute sync (reuses fetched data)
	const syncSpinner = spinner("Syncing remote items...")?.start()
	try {
		await sync()
		syncSpinner?.succeed()

		// 5. Install dependencies
		const installSpinner = spinner("Installing dependencies...")?.start()
		await installCacheDependencies()
		installSpinner?.succeed()

		showSyncComplete(plan, options)

		return { success: true, cancelled: false, plan }
	} catch (error) {
		syncSpinner?.fail()
		showSyncError(error, options)
		return { success: false, cancelled: false, plan }
	}
}
