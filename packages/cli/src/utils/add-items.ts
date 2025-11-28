import { configWithDefaults } from "@/src/registry/config"
import { resolveRegistryTree } from "@/src/registry/resolver"
import type { Config } from "@/src/schema"
import { handleError } from "@/src/utils/handle-error"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { updateDependencies } from "@/src/utils/update-dependencies"
import { updateFiles } from "@/src/utils/update-files"

export async function addItems(
	items: string[],
	type: "agents" | "tools" | "prompts",
	config: Config,
	options: {
		overwrite?: boolean
		silent?: boolean
		path?: string
	},
) {
	options = {
		overwrite: false,
		silent: false,
		...options,
	}

	if (!items.length) {
		return
	}

	const registrySpinner = spinner(`Checking registry.`, {
		silent: options.silent,
	})?.start()

	const tree = await resolveRegistryTree(
		items,
		type,
		configWithDefaults(config),
	)

	if (!tree) {
		registrySpinner?.fail()
		return handleError(new Error("Failed to fetch items from registry."))
	}

	registrySpinner?.succeed()

	await updateDependencies(tree.dependencies, tree.devDependencies, config, {
		silent: options.silent,
	})

	await updateFiles(tree.files, type, config, {
		overwrite: options.overwrite,
		silent: options.silent,
		path: options.path,
	})

	if (tree.docs) {
		logger.info(tree.docs)
	}
}
