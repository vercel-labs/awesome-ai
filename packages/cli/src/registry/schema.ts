import { z } from "zod"

export const registryItemTypeSchema = z.enum([
	"registry:agent",
	"registry:tool",
	"registry:prompt",
	"registry:lib",
])

export const registryItemFileSchema = z.object({
	path: z.string(),
	content: z.string().optional(),
	type: registryItemTypeSchema,
	target: z.string().optional(),
})

export const registryItemSchema = z.object({
	$schema: z.string().optional(),
	name: z.string(),
	type: registryItemTypeSchema,
	title: z.string().optional(),
	author: z.string().min(2).optional(),
	description: z.string().optional(),
	dependencies: z.array(z.string()).optional(),
	devDependencies: z.array(z.string()).optional(),
	registryDependencies: z.array(z.string()).optional(),
	files: z.array(registryItemFileSchema).optional(),
	meta: z.record(z.string(), z.any()).optional(),
	docs: z.string().optional(),
	categories: z.array(z.string()).optional(),
})

export type RegistryItem = z.infer<typeof registryItemSchema>

export const registrySchema = z.object({
	name: z.string(),
	homepage: z.string(),
	items: z.array(registryItemSchema),
})

export type Registry = z.infer<typeof registrySchema>

export const registryIndexSchema = z.array(registryItemSchema)

export const registryResolvedItemsTreeSchema = registryItemSchema.pick({
	dependencies: true,
	devDependencies: true,
	files: true,
	docs: true,
})

export const registryConfigItemSchema = z.union([
	z.string().refine((s) => s.includes("{name}") && s.includes("{type}"), {
		message: "Registry URL must include {name} and {type} placeholders",
	}),
	z.object({
		url: z
			.string()
			.refine((s) => s.includes("{name}") && s.includes("{type}"), {
				message: "Registry URL must include {name} and {type} placeholders",
			}),
		params: z.record(z.string(), z.string()).optional(),
		headers: z.record(z.string(), z.string()).optional(),
	}),
])

export const registryConfigSchema = z.record(
	z.string().refine((key) => key.startsWith("@"), {
		message: "Registry names must start with @ (e.g., @awesome-ai)",
	}),
	registryConfigItemSchema,
)
