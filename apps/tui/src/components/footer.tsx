import { colors } from "../theme"
import { useSelectedModel, useShowDebug } from "./atoms"

export function Footer() {
	const [model] = useSelectedModel()
	const [showDebug] = useShowDebug()

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
				<span fg={colors.green}>{model}</span>
				<span fg={colors.muted}> │ / commands │ ↑ ↓ history</span>
			</text>
			<text fg={colors.muted}>{showDebug ? "debug on" : "session active"}</text>
		</box>
	)
}
