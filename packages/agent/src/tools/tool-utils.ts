import { z } from "zod"

export function toolOutput<
	P extends Record<string, any>,
	S extends Record<string, any>,
	E extends Record<string, any>,
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
