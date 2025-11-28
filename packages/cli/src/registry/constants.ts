import type { z } from "zod"
import type { registryConfigSchema } from "@/src/registry/schema"

export const REGISTRY_URL =
	process.env.REGISTRY_URL ??
	"https://raw.githubusercontent.com/org/repo/main/registry"

// Built-in registries that are always available and cannot be overridden
export const BUILTIN_REGISTRIES: z.infer<typeof registryConfigSchema> = {
	"@awesome-ai": `${REGISTRY_URL}/{type}/{name}.json`,
}
