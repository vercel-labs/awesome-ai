import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"
import type React from "react"
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
	return (
		<html lang="en">
			<body className={`${jetbrainsMono.className} antialiased`}>
				{children}
			</body>
		</html>
	)
}
