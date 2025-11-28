import { z } from "zod"

/**
 * Creates a union schema for tool output with pending, success, and error states.
 * This ensures consistent output structure across all tools.
 */
export function toolOutput<
	P extends Record<string, z.ZodTypeAny>,
	S extends Record<string, z.ZodTypeAny>,
	E extends Record<string, z.ZodTypeAny>,
>({ pending, success, error }: { pending: P; success: S; error: E }) {
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
	])
}

