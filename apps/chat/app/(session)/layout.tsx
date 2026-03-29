import { type ReactNode, Suspense } from "react"
import { ConvexProvider } from "@/components/providers/convex-provider"
import { api } from "@/convex/_generated/api"
import { preloadAuthQuery, tokenRequired } from "@/lib/auth-server"

export default async function SessionLayout({ children }: { children: ReactNode }) {
	return (
		<Suspense>
			<Content>{children}</Content>
		</Suspense>
	)
}

async function Content({ children }: { children: ReactNode }) {
	const auth = preloadAuthQuery(api.auth.getAuth, {})
	const token = await tokenRequired()
	return (
		<ConvexProvider initialToken={token} auth={auth}>
			{children}
		</ConvexProvider>
	)
}
