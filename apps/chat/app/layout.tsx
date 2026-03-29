import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"
import type React from "react"
import { getToken } from "@/lib/auth-server"
import { ConvexClientProvider } from "@/lib/convex"
import "./globals.css"

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
	title: "awesome-ai chat",
	description: "Chat with AI agents powered by awesome-ai",
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const token = await getToken()
	return (
		<html lang="en">
			<body className={`${jetbrainsMono.className} antialiased`}>
				<ConvexClientProvider initialToken={token}>{children}</ConvexClientProvider>
			</body>
		</html>
	)
}
