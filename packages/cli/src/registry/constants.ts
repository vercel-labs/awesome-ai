import type { z } from "zod"
import type { registryConfigSchema } from "./schema"

// Registry URL can be customized via environment variable
// Supports branch names: https://raw.githubusercontent.com/{owner}/{repo}/{branch}/packages/registry/registry
export const REGISTRY_URL =
	process.env.AWESOME_AI_REGISTRY_URL ??
	process.env.REGISTRY_URL ??
	"https://raw.githubusercontent.com/vercel-labs/awesome-ai/main/packages/registry/registry"

// Built-in registries that are always available and cannot be overridden
export const BUILTIN_REGISTRIES: z.infer<typeof registryConfigSchema> = {
	"@awesome-ai": `${REGISTRY_URL}/{type}/{name}.json`,
}
