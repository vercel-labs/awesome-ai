import { redirect } from "next/navigation"
import { Suspense } from "react"
import { tokenRequired } from "@/lib/auth-server"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<Suspense>
				<SessionCheck />
			</Suspense>
			{children}
		</>
	)
}

async function SessionCheck() {
	const token = await tokenRequired().catch(() => null)
	if (token) redirect("/")
	return null
}
