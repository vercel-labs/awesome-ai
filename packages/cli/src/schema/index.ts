import { z } from "zod"
import { registryConfigSchema } from "@/src/registry/schema"

const coerceBoolean = z
	.union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")])
	.default(true)

export const rawConfigSchema = z
	.object({
		$schema: z.string().optional(),
		tsx: coerceBoolean,
		aliases: z.object({
			agents: z.string(),
			tools: z.string(),
			prompts: z.string(),
		}),
		registries: registryConfigSchema.optional(),
	})
	.strict()

export const configSchema = rawConfigSchema.extend({
	resolvedPaths: z.object({
		cwd: z.string(),
		agents: z.string(),
		tools: z.string(),
		prompts: z.string(),
	}),
})

export type Config = z.infer<typeof configSchema>
export type RawConfig = z.infer<typeof rawConfigSchema>
