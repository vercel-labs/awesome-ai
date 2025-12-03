import { useState } from "react"
import { colors } from "../theme"

interface ThinkingSectionProps {
	thinking: string
}

export function ThinkingSection({ thinking }: ThinkingSectionProps) {
	const [expanded, setExpanded] = useState(false)

	const toggle = () => setExpanded(!expanded)

	// Count lines for preview
	const lines = thinking.split("\n")
	const previewLines = lines.slice(0, 2).join("\n")
	const hasMore = lines.length > 2 || thinking.length > 120

	return (
		<box style={{ flexDirection: "column", marginBottom: 1 }}>
			<box
				onMouseDown={toggle}
				style={{
					flexDirection: "row",
					backgroundColor: colors.bgLight,
				}}
			>
				<text fg={colors.muted}>
					<span fg={colors.pink}>{expanded ? "▼" : "▶"}</span>{" "}
					<span fg={colors.muted}>thinking</span>
					{!expanded && hasMore && (
						<span fg={colors.border}> (click to expand)</span>
					)}
				</text>
			</box>

			{expanded ? (
				<box
					style={{
						backgroundColor: colors.bgLight,
						paddingLeft: 2,
						paddingRight: 1,
						paddingTop: 0,
						paddingBottom: 1,
					}}
				>
					<text fg={colors.muted}>{thinking}</text>
				</box>
			) : (
				hasMore && (
					<box
						style={{
							backgroundColor: colors.bgLight,
							paddingLeft: 2,
							paddingRight: 1,
						}}
					>
						<text fg={colors.border}>
							{previewLines.slice(0, 120)}
							{previewLines.length > 120 ? "..." : ""}
						</text>
					</box>
				)
			)}
		</box>
	)
}
