import { z } from "zod"

/**
 * Creates a union schema for tool output with pending, success, error, and optional streaming states.
 * This ensures consistent output structure across all tools.
 */
export function toolOutput<
	P extends Record<string, z.ZodTypeAny>,
	S extends Record<string, z.ZodTypeAny>,
	E extends Record<string, z.ZodTypeAny>,
	T extends Record<string, z.ZodTypeAny> | undefined = undefined,
>({
	pending,
	success,
	error,
	streaming,
}: {
	pending: P
	success: S
	error: E
	streaming?: T
}) {
	return z.union([
		z.object({
			status: z.literal("pending"),
			message: z.string(),
			...pending,
		}),
		z.object({
			status: z.literal("success"),
			message: z.string(),
			...success,
		}),
		z.object({
			status: z.literal("error"),
			message: z.string(),
			error: z.string(),
			...error,
		}),
		...(streaming
			? [
					z.object({
						status: z.literal("streaming"),
						message: z.string(),
						...streaming,
					}),
				]
			: []),
	])
}
