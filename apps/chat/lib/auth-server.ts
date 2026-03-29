import "server-only"
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs"
import { getToken as getBetterAuthToken } from "@convex-dev/better-auth/utils"
import { preloadQuery } from "convex/nextjs"
import type { Preloaded } from "convex/react"
import { type ArgsAndOptions, type FunctionReference } from "convex/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { isAuthError, isRetryableAuthError, isTokenStale } from "@/lib/auth-utils"

function envRequired(name: "NEXT_PUBLIC_CONVEX_SITE_URL" | "NEXT_PUBLIC_CONVEX_URL") {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`)
	}
	return value
}

const convexUrl = envRequired("NEXT_PUBLIC_CONVEX_URL")
const convexSiteUrl = envRequired("NEXT_PUBLIC_CONVEX_SITE_URL")

type EmptyObject = Record<string, never>

type OptionalArgs<Query extends FunctionReference<"query">> = Query["_args"] extends EmptyObject
	? [args?: EmptyObject]
	: [args: Query["_args"]]

function getArgsAndOptions<Query extends FunctionReference<"query">>(
	args: OptionalArgs<Query>,
	token?: string,
): ArgsAndOptions<Query, { token?: string }> {
	return [args[0], { token }]
}

const jwtCacheOptions = {
	jwtCache: {
		enabled: true,
		isAuthError,
	},
}

export const { handler, fetchAuthQuery, isAuthenticated, fetchAuthMutation } =
	convexBetterAuthNextJs({
		convexUrl,
		convexSiteUrl,
		...jwtCacheOptions,
	})

async function getRequestHeaders() {
	const requestHeaders = await headers()
	const mutableHeaders = new Headers(requestHeaders)
	mutableHeaders.delete("content-length")
	mutableHeaders.delete("transfer-encoding")
	mutableHeaders.set("accept-encoding", "identity")
	return mutableHeaders
}

const getRequestToken = cache(async (forceRefresh = false) => {
	const requestHeaders = await getRequestHeaders()
	let token = await getBetterAuthToken(convexSiteUrl, requestHeaders, {
		...jwtCacheOptions,
		forceRefresh,
	})
	if (!forceRefresh && isTokenStale(token.token)) {
		token = await getBetterAuthToken(convexSiteUrl, requestHeaders, {
			...jwtCacheOptions,
			forceRefresh: true,
		})
	}
	return token
})

async function callWithTokenRetry<T>(
	fn: (token?: string) => Promise<T>,
): Promise<{ result: T; token: string | undefined }> {
	const cachedToken = await getRequestToken()
	try {
		return {
			result: await fn(cachedToken.token),
			token: cachedToken.token,
		}
	} catch (error) {
		if (!isRetryableAuthError(error)) throw error
	}
	const freshToken = await getRequestToken(true)
	return {
		result: await fn(freshToken.token),
		token: freshToken.token,
	}
}

export async function preloadAuthQuery<Query extends FunctionReference<"query">>(
	query: Query,
	...args: OptionalArgs<Query>
): Promise<Preloaded<Query>> {
	try {
		const { result } = await callWithTokenRetry((token?: string) => {
			const argsAndOptions = getArgsAndOptions(args, token)
			return preloadQuery(query, ...argsAndOptions)
		})
		return result
	} catch (error) {
		if (isRetryableAuthError(error)) redirect("/login")
		throw error
	}
}

export const tokenRequired = cache(async () => {
	try {
		const { token } = await callWithTokenRetry(async (currentToken?: string) => currentToken)
		if (!token) redirect("/login")
		return token
	} catch (error) {
		if (isRetryableAuthError(error)) redirect("/login")
		throw error
	}
})
