import { colors } from "../theme"

interface HeaderProps {
	agentName: string
}

export function Header({ agentName }: HeaderProps) {
	return (
		<box
			style={{
				height: 1,
				paddingLeft: 1,
				paddingRight: 1,
				flexDirection: "row",
				justifyContent: "space-between",
			}}
		>
			<text>
				<span fg={colors.muted}>v1.0.0</span>
				<span fg={colors.muted}> │ </span>
				<span fg={colors.green}>{agentName}</span>
				<span fg={colors.muted}> │ </span>
				<span fg={colors.muted}>⌥ S</span>
				<span fg={colors.muted}> shortcuts</span>
			</text>
		</box>
	)
}
