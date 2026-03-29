import { type ClassValue, clsx } from "clsx"
import { ConvexError } from "convex/values"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export const isAuthError = (err: unknown) => {
	const msg =
		(err instanceof ConvexError && err.data) || (err instanceof Error && err.message) || ""
	return /auth/i.test(String(msg))
}
