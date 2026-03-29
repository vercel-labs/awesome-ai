"use client"

import { authClient } from "@/lib/auth-client"

export default function SignInPage() {
	return (
		<main className="min-h-screen flex items-center justify-center bg-background p-6">
			<div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-3">
				<h1 className="text-lg font-semibold text-foreground">Sign in</h1>
				<p className="text-sm text-muted-foreground">
					Continue with your Vercel account to use awesome-ai chat.
				</p>
				<button
					type="button"
					className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
					onClick={() =>
						authClient.signIn.social({
							provider: "vercel",
							callbackURL: "/",
						})
					}
				>
					Sign in with Vercel
				</button>
			</div>
		</main>
	)
}
