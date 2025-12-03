import { useAtom } from "@lfades/atom"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/react"
import { useEffect, useRef } from "react"
import { colors } from "../theme"
import { debugLogsAtom, inputAtom } from "./atoms"

export function DebugOverlay() {
	const [logs] = useAtom(debugLogsAtom)
	const { width, height } = useTerminalDimensions()
	const scrollRef = useRef<ScrollBoxRenderable>(null)

	// Auto-scroll to bottom when new logs are added
	useEffect(() => {
		if (scrollRef.current && logs.length > 0) {
			setTimeout(() => {
				scrollRef.current?.scrollTo(scrollRef.current.scrollHeight)
			}, 1)
		}
	}, [logs.length])

	// Refocus input when debug overlay closes (scrollbox steals focus)
	useEffect(() => {
		return () => {
			inputAtom.get()?.focus()
		}
	}, [])

	return (
		<box
			style={{
				position: "absolute",
				top: Math.floor(height / 2) - 12,
				left: Math.floor(width / 2) - 30,
				width: 60,
				height: 24,
				backgroundColor: colors.bg,
				border: true,
				borderStyle: "single",
				borderColor: colors.border,
				paddingLeft: 1,
				paddingRight: 1,
				flexDirection: "column",
			}}
		>
			<text fg={colors.green}>
				Debug Console
				<span fg={colors.muted}> (⌥ D to close, ↑↓ scroll)</span>
			</text>
			<box style={{ height: 1 }} />
			<scrollbox
				ref={scrollRef}
				style={{
					flexGrow: 1,
					contentOptions: {
						backgroundColor: colors.bg,
					},
					scrollbarOptions: {
						showArrows: true,
						trackOptions: {
							foregroundColor: colors.green,
							backgroundColor: colors.bgLight,
						},
					},
				}}
				focused
			>
				{logs.length === 0 ? (
					<text fg={colors.muted}>No logs yet...</text>
				) : (
					logs.map((log, i) => (
						<text key={i} fg={colors.text}>
							{log}
						</text>
					))
				)}
			</scrollbox>
		</box>
	)
}
