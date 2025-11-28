import type { z } from "zod"
import { buildUrlAndHeadersForRegistryItem } from "@/src/registry/builder"
import { configWithDefaults } from "@/src/registry/config"
import { clearRegistryContext } from "@/src/registry/context"
import { extractEnvVars } from "@/src/registry/env"
import { RegistryMissingEnvironmentVariablesError } from "@/src/registry/errors"
import type { registryConfigItemSchema } from "@/src/registry/schema"
import type { Config } from "@/src/schema"

export function extractEnvVarsFromRegistryConfig(
	config: z.infer<typeof registryConfigItemSchema>,
): string[] {
	const vars = new Set<string>()

	if (typeof config === "string") {
		for (const v of extractEnvVars(config)) {
			vars.add(v)
		}
	} else {
		for (const v of extractEnvVars(config.url)) {
			vars.add(v)
		}

		if (config.params) {
			for (const value of Object.values(config.params)) {
				for (const v of extractEnvVars(value)) {
					vars.add(v)
				}
			}
		}

		if (config.headers) {
			for (const value of Object.values(config.headers)) {
				for (const v of extractEnvVars(value)) {
					vars.add(v)
				}
			}
		}
	}

	return Array.from(vars)
}

export function validateRegistryConfig(
	registryName: string,
	config: z.infer<typeof registryConfigItemSchema>,
): void {
	const requiredVars = extractEnvVarsFromRegistryConfig(config)
	const missing = requiredVars.filter((v) => !process.env[v])

	if (missing.length > 0) {
		throw new RegistryMissingEnvironmentVariablesError(registryName, missing)
	}
}

export function validateRegistryConfigForItems(
	items: string[],
	config?: Config,
): void {
	for (const item of items) {
		buildUrlAndHeadersForRegistryItem(item, configWithDefaults(config))
	}

	clearRegistryContext()
}
