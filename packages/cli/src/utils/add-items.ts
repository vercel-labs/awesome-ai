import { configWithDefaults } from "../registry/config"
import { resolveRegistryTree } from "../registry/resolver"
import type { RegistryItem, RegistryItemCategory } from "../registry/schema"
import type { Config } from "../schema"
import { handleError } from "./handle-error"
import { logger } from "./logger"
import { spinner } from "./spinner"
import { updateDependencies } from "./update-dependencies"
import { updateFiles } from "./update-files"

export interface AddItemsResult {
	filesCreated: string[]
	filesUpdated: string[]
	resolvedItems: RegistryItem[]
}

export async function addItems(
	items: string[],
	type: RegistryItemCategory,
	config: Config,
	options: {
		overwrite?: boolean
		silent?: boolean
		path?: string
		yes?: boolean
	},
): Promise<AddItemsResult | undefined> {
	options = {
		overwrite: false,
		silent: false,
		yes: false,
		...options,
	}

	if (!items.length) {
		return
	}

	const registrySpinner = spinner(`Checking registry.`, {
		silent: options.silent,
	})?.start()

	const tree = await resolveRegistryTree(items, type, configWithDefaults(config))

	if (!tree) {
		registrySpinner?.fail()
		return handleError(new Error("Failed to fetch items from registry."))
	}

	registrySpinner?.succeed()

	const { filesCreated, filesUpdated } = await updateFiles(tree.files, type, config, {
		overwrite: options.overwrite,
		silent: options.silent,
		path: options.path,
		yes: options.yes,
	})

	// Only install dependencies if files were actually created or updated
	if (filesCreated.length || filesUpdated.length) {
		await updateDependencies(tree.dependencies, tree.devDependencies, config, {
			silent: options.silent,
		})
	}

	if (tree.docs) {
		logger.info(tree.docs)
	}

	return {
		filesCreated,
		filesUpdated,
		resolvedItems: tree.resolvedItems,
	}
}
