import { useAtom } from "@lfades/atom"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useEffect, useRef } from "react"
import { COMMANDS } from "../commands"
import { colors } from "../theme"
import { commandFilterAtom, selectedCommandAtom } from "./atoms"

const MAX_VISIBLE_ITEMS = 10

export function CommandPalette() {
	const [filter] = useAtom(commandFilterAtom)
	const [selectedIndex, setSelectedIndex] = useAtom(selectedCommandAtom)
	const scrollRef = useRef<ScrollBoxRenderable>(null)
	const commands = COMMANDS.filter((cmd) =>
		cmd.name.toLowerCase().includes(filter.toLowerCase()),
	)

	// Keep selectedIndex in bounds when filter changes
	useEffect(() => {
		if (selectedIndex >= commands.length && commands.length > 0) {
			setSelectedIndex(commands.length - 1)
		}
	}, [commands.length, selectedIndex, setSelectedIndex])

	// Scroll to keep selected command visible
	useEffect(() => {
		if (scrollRef.current && commands.length > 0) {
			const scrollTop = Math.max(0, selectedIndex - MAX_VISIBLE_ITEMS + 1)
			scrollRef.current.scrollTo(scrollTop)
		}
	}, [selectedIndex, commands.length])

	if (commands.length === 0) return null

	return (
		<box
			style={{
				marginLeft: 1,
				marginRight: 1,
				marginBottom: 0,
				border: true,
				borderStyle: "single",
				borderColor: colors.border,
				backgroundColor: colors.bg,
				flexDirection: "column",
				height: Math.min(commands.length + 2, 12),
			}}
		>
			<scrollbox
				ref={scrollRef}
				style={{
					flexGrow: 1,
					contentOptions: {
						backgroundColor: colors.bg,
					},
					scrollbarOptions: {
						trackOptions: {
							foregroundColor: colors.green,
							backgroundColor: colors.bgLight,
						},
					},
				}}
				focused={false}
			>
				{commands.map((cmd, i) => (
					<box
						key={cmd.name}
						style={{
							height: 1,
							backgroundColor:
								i === selectedIndex ? colors.greenDark : colors.bg,
							paddingLeft: 1,
							paddingRight: 1,
						}}
					>
						<text>
							<span fg={colors.green}>{cmd.name.padEnd(14)}</span>{" "}
							<span fg={colors.muted}>{cmd.description}</span>
						</text>
					</box>
				))}
			</scrollbox>
		</box>
	)
}
