import { buildUrlAndHeadersForRegistryItem } from "./builder"
import { configWithDefaults } from "./config"
import { clearRegistryContext } from "./context"
import {
	RegistryInvalidNamespaceError,
	RegistryNotFoundError,
	RegistryParseError,
} from "./errors"
import { fetchRegistry } from "./fetcher"
import {
	fetchRegistryItems,
	resolveRegistryTree,
} from "./resolver"
import {
	type RegistryItemCategory,
	registrySchema,
} from "./schema"
import { isUrl } from "./utils"
import type { Config } from "../schema"

export async function getRegistry(
	name: string,
	type: RegistryItemCategory,
	options?: {
		config?: Partial<Config>
	},
) {
	const { config } = options || {}

	if (isUrl(name)) {
		const [result] = await fetchRegistry([name])
		try {
			return registrySchema.parse(result)
		} catch (error) {
			throw new RegistryParseError(name, error)
		}
	}

	if (!name.startsWith("@")) {
		throw new RegistryInvalidNamespaceError(name)
	}

	let registryName = name
	if (!registryName.endsWith("/registry")) {
		registryName = `${registryName}/registry`
	}

	const urlAndHeaders = buildUrlAndHeadersForRegistryItem(
		registryName as `@${string}`,
		type,
		configWithDefaults(config),
	)

	if (!urlAndHeaders?.url) {
		throw new RegistryNotFoundError(registryName)
	}

	const [result] = await fetchRegistry([urlAndHeaders.url])

	try {
		return registrySchema.parse(result)
	} catch (error) {
		throw new RegistryParseError(registryName, error)
	}
}

export async function getRegistryItems(
	items: string[],
	type: RegistryItemCategory,
	options?: {
		config?: Partial<Config>
	},
) {
	const { config } = options || {}

	clearRegistryContext()

	return fetchRegistryItems(items, type, configWithDefaults(config))
}

export async function resolveRegistryItems(
	items: string[],
	type: RegistryItemCategory,
	options?: {
		config?: Partial<Config>
	},
) {
	const { config } = options || {}

	clearRegistryContext()
	return resolveRegistryTree(items, type, configWithDefaults(config))
}
