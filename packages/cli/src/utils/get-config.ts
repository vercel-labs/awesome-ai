import { cosmiconfig } from "cosmiconfig"
import path from "path"
import { loadConfig } from "tsconfig-paths"
import { BUILTIN_REGISTRIES } from "@/src/registry/constants"
import { ConfigParseError } from "@/src/registry/errors"
import {
	type Config,
	configSchema,
	type RawConfig,
	rawConfigSchema,
} from "@/src/schema"
import { resolveImport } from "@/src/utils/resolve-import"

export const DEFAULT_AGENTS = "@/agents"
export const DEFAULT_TOOLS = "@/tools"
export const DEFAULT_PROMPTS = "@/prompts"

export const explorer = cosmiconfig("agents", {
	searchPlaces: ["agents.json"],
})

export async function getConfig(cwd: string): Promise<Config | null> {
	const config = await getRawConfig(cwd)

	if (!config) {
		return null
	}

	return await resolveConfigPaths(cwd, config)
}

export async function resolveConfigPaths(
	cwd: string,
	config: RawConfig,
): Promise<Config> {
	config.registries = {
		...BUILTIN_REGISTRIES,
		...(config.registries || {}),
	}

	const tsConfig = await loadConfig(cwd)

	if (tsConfig.resultType === "failed") {
		throw new Error(
			`Failed to load ${config.tsx ? "tsconfig" : "jsconfig"}.json. ${
				tsConfig.message ?? ""
			}`.trim(),
		)
	}

	return configSchema.parse({
		...config,
		resolvedPaths: {
			cwd,
			agents:
				(await resolveImport(config.aliases.agents, tsConfig)) ||
				path.resolve(cwd, "src/agents"),
			tools:
				(await resolveImport(config.aliases.tools, tsConfig)) ||
				path.resolve(cwd, "src/tools"),
			prompts:
				(await resolveImport(config.aliases.prompts, tsConfig)) ||
				path.resolve(cwd, "src/prompts"),
		},
	})
}

export async function getRawConfig(cwd: string): Promise<RawConfig | null> {
	try {
		const configResult = await explorer.search(cwd)

		if (!configResult) {
			return null
		}

		const config = rawConfigSchema.parse(configResult.config)

		if (config.registries) {
			for (const registryName of Object.keys(config.registries)) {
				if (registryName in BUILTIN_REGISTRIES) {
					throw new Error(
						`"${registryName}" is a built-in registry and cannot be overridden.`,
					)
				}
			}
		}

		return config
	} catch (error) {
		if (error instanceof Error && error.message.includes("reserved registry")) {
			throw error
		}
		throw new ConfigParseError(cwd, error)
	}
}

type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export function createConfig(partial?: DeepPartial<Config>): Config {
	const defaultConfig: Config = {
		resolvedPaths: {
			cwd: process.cwd(),
			agents: "",
			tools: "",
			prompts: "",
		},
		tsx: true,
		aliases: {
			agents: DEFAULT_AGENTS,
			tools: DEFAULT_TOOLS,
			prompts: DEFAULT_PROMPTS,
		},
		registries: {
			...BUILTIN_REGISTRIES,
		},
	}

	if (partial) {
		return {
			...defaultConfig,
			...partial,
			resolvedPaths: {
				...defaultConfig.resolvedPaths,
				...(partial.resolvedPaths || {}),
			},
			aliases: {
				...defaultConfig.aliases,
				...(partial.aliases || {}),
			},
			registries: {
				...defaultConfig.registries,
				...(partial.registries || {}),
			},
		}
	}

	return defaultConfig
}
