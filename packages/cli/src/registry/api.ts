import { buildUrlAndHeadersForRegistryItem } from "@/src/registry/builder"
import { configWithDefaults } from "@/src/registry/config"
import { clearRegistryContext } from "@/src/registry/context"
import {
	RegistryInvalidNamespaceError,
	RegistryNotFoundError,
	RegistryParseError,
} from "@/src/registry/errors"
import { fetchRegistry } from "@/src/registry/fetcher"
import {
	fetchRegistryItems,
	resolveRegistryTree,
} from "@/src/registry/resolver"
import { registrySchema } from "@/src/registry/schema"
import { isUrl } from "@/src/registry/utils"
import type { Config } from "@/src/schema"

export async function getRegistry(
	name: string,
	type: "agents" | "tools" | "prompts",
	options?: {
		config?: Partial<Config>
		useCache?: boolean
	},
) {
	const { config, useCache } = options || {}

	if (isUrl(name)) {
		const [result] = await fetchRegistry([name], { useCache })
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

	const [result] = await fetchRegistry([urlAndHeaders.url], { useCache })

	try {
		return registrySchema.parse(result)
	} catch (error) {
		throw new RegistryParseError(registryName, error)
	}
}

export async function getRegistryItems(
	items: string[],
	type: "agents" | "tools" | "prompts",
	options?: {
		config?: Partial<Config>
		useCache?: boolean
	},
) {
	const { config, useCache = false } = options || {}

	clearRegistryContext()

	return fetchRegistryItems(items, type, configWithDefaults(config), {
		useCache,
	})
}

export async function resolveRegistryItems(
	items: string[],
	type: "agents" | "tools" | "prompts",
	options?: {
		config?: Partial<Config>
		useCache?: boolean
	},
) {
	const { config, useCache = false } = options || {}

	clearRegistryContext()
	return resolveRegistryTree(items, type, configWithDefaults(config), {
		useCache,
	})
}
