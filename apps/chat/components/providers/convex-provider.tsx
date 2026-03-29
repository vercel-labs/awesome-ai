"use client"

import type { Preloaded } from "convex/react"
import { ConvexProviderWithAuth, ConvexReactClient, useConvexAuth } from "convex/react"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { api } from "@/convex/_generated/api"
import { AuthQuery, useAuth } from "@/hooks/queries"
import { authClient } from "@/lib/auth-client"
import { isTokenStale } from "@/lib/auth-utils"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) {
	throw new Error("NEXT_PUBLIC_CONVEX_URL is required")
}

const convex = new ConvexReactClient(convexUrl, { expectAuth: true })
let initialTokenUsed = false

type SessionState = ReturnType<typeof authClient.useSession>

function useBetterAuth(initialToken: string | null | undefined, sessionState: SessionState) {
	const [cachedToken, setCachedToken] = useState<string | null>(() => {
		if (initialTokenUsed) return null
		const token = initialToken ?? null
		return isTokenStale(token) ? null : token
	})
	const cachedTokenRef = useRef(cachedToken)
	const pendingTokenRef = useRef<Promise<string | null> | null>(null)
	const [authResetVersion, setAuthResetVersion] = useState(0)
	const { data: session, isPending: isSessionPending } = sessionState
	const sessionId = session?.session?.id

	useEffect(() => {
		cachedTokenRef.current = cachedToken
	}, [cachedToken])

	useEffect(() => {
		if (!initialTokenUsed) {
			initialTokenUsed = true
		}
	}, [])

	useEffect(() => {
		if (!session && !isSessionPending && cachedTokenRef.current) {
			setCachedToken(null)
		}
	}, [isSessionPending, session])

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken = false }: { forceRefreshToken?: boolean } = {}) => {
			const currentToken = cachedTokenRef.current

			if (!forceRefreshToken && currentToken && !isTokenStale(currentToken)) {
				return currentToken
			}

			if (pendingTokenRef.current) {
				return pendingTokenRef.current
			}

			pendingTokenRef.current = authClient.convex
				.token({ fetchOptions: { throw: false } })
				.then((result) => {
					const nextToken = result.data?.token ?? null
					setCachedToken(nextToken)
					return nextToken
				})
				.catch(() => {
					setCachedToken(null)
					return null
				})
				.finally(() => {
					pendingTokenRef.current = null
				})

			return pendingTokenRef.current
		},
		[authResetVersion],
	)

	const forceRefreshAccessToken = useCallback(async () => {
		const token = await fetchAccessToken({ forceRefreshToken: true })
		setAuthResetVersion((value) => value + 1)
		return token
	}, [fetchAccessToken])

	return useMemo(
		() => ({
			isLoading: isSessionPending && !cachedToken,
			isAuthenticated: Boolean(session?.session) || cachedToken !== null,
			fetchAccessToken,
			forceRefreshAccessToken,
		}),
		[cachedToken, fetchAccessToken, forceRefreshAccessToken, isSessionPending, sessionId],
	)
}

function SessionAuthSync({
	forceRefreshAccessToken,
	sessionState,
}: {
	forceRefreshAccessToken: () => Promise<string | null>
	sessionState: SessionState
}) {
	const { isLoading: isConvexLoading } = useConvexAuth()
	const { data: session, isPending: isSessionPending } = sessionState
	const auth = useAuth()
	const recoveryAttemptRef = useRef<string | null>(null)
	const redirectingRef = useRef(false)

	useEffect(() => {
		if (auth.isAuthenticated) {
			recoveryAttemptRef.current = null
			redirectingRef.current = false
			return
		}

		if (isSessionPending || isConvexLoading) return

		const sessionId = session?.session?.id ?? null

		if (sessionId && recoveryAttemptRef.current !== sessionId) {
			recoveryAttemptRef.current = sessionId
			void forceRefreshAccessToken()
			return
		}

		if (redirectingRef.current) return
		redirectingRef.current = true

		void authClient.getSession().finally(() => {
			window.location.replace("/login")
		})
	}, [
		auth.isAuthenticated,
		forceRefreshAccessToken,
		isConvexLoading,
		isSessionPending,
		session?.session?.id,
	])

	return null
}

export function ConvexProvider({
	children,
	initialToken,
	auth,
}: {
	children: ReactNode
	initialToken: string
	auth: Promise<Preloaded<typeof api.auth.getAuth>>
}) {
	const sessionState = authClient.useSession()
	const betterAuth = useBetterAuth(initialToken, sessionState)
	const useConvexBetterAuth = useCallback(() => betterAuth, [betterAuth])

	return (
		<ConvexProviderWithAuth client={convex} useAuth={useConvexBetterAuth}>
			<AuthQuery preloaded={auth}>
				<Suspense fallback={null}>
					<SessionAuthSync
						forceRefreshAccessToken={betterAuth.forceRefreshAccessToken}
						sessionState={sessionState}
					/>
				</Suspense>
				{children}
			</AuthQuery>
		</ConvexProviderWithAuth>
	)
}
