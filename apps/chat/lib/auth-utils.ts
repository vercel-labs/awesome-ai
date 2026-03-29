import { ConvexError } from "convex/values"

export const AUTH_TOKEN_REFRESH_LEEWAY_SECONDS = 10

const ErrorCodes = {
	NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
} as const

function getErrorCode(error: unknown) {
	if (!(error instanceof ConvexError)) return

	const { code } = error.data
	if (typeof code === "string") return code
}

function decodeBase64(value: string) {
	if (typeof atob === "function") return atob(value)

	return Buffer.from(value, "base64").toString("utf-8")
}

function getJwtPayload(token: string) {
	const payload = token.split(".")[1]
	if (!payload) return

	try {
		const normalized = payload.replaceAll("-", "+").replaceAll("_", "/")
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
		return JSON.parse(decodeBase64(padded)) as { exp?: unknown }
	} catch {
		return
	}
}

export function isAuthError(error: unknown): boolean {
	const code = getErrorCode(error)
	return code === ErrorCodes.NOT_AUTHENTICATED
}

export function isRetryableAuthError(error: unknown): boolean {
	return getErrorCode(error) === ErrorCodes.NOT_AUTHENTICATED
}

export function isTokenStale(
	token: string | null | undefined,
	leewaySeconds = AUTH_TOKEN_REFRESH_LEEWAY_SECONDS,
): boolean {
	if (!token) return true

	const payload = getJwtPayload(token)
	if (typeof payload?.exp !== "number") return true

	const now = Math.floor(Date.now() / 1000)
	return now + leewaySeconds >= payload.exp
}
