import { BUILTIN_REGISTRIES } from "@/src/registry/constants"
import type { Config, RawConfig } from "@/src/schema"

export function configWithDefaults(config?: Partial<Config> | Config): Config {
	const defaultConfig: RawConfig = {
		tsx: true,
		aliases: {
			agents: "@/agents",
			tools: "@/tools",
			prompts: "@/prompts",
		},
		registries: BUILTIN_REGISTRIES,
	}

	const merged = {
		...defaultConfig,
		...(config || {}),
		aliases: {
			...defaultConfig.aliases,
			...(config?.aliases || {}),
		},
		registries: {
			...BUILTIN_REGISTRIES,
			...(config?.registries || {}),
		},
	}

	return merged as Config
}
