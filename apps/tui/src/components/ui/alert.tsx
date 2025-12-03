import { useAtom } from "@lfades/atom"
import { useTerminalDimensions } from "@opentui/react"
import { colors } from "../../theme"
import { type AlertMessage, alertsAtom } from "../atoms"

const ALERT_WIDTH = 36

function AlertItem({ alert }: { alert: AlertMessage }) {
	const borderColor =
		alert.type === "error" ? "#ef4444" : alert.type === "success" ? colors.green : colors.border

	return (
		<box
			style={{
				width: ALERT_WIDTH,
				backgroundColor: colors.bg,
				border: true,
				borderStyle: "single",
				borderColor,
				paddingLeft: 1,
				paddingRight: 1,
			}}
		>
			<text fg={colors.text}>{alert.message}</text>
		</box>
	)
}

export function AlertContainer() {
	const [alerts] = useAtom(alertsAtom)
	const { width: termWidth, height: termHeight } = useTerminalDimensions()

	if (alerts.length === 0) return null

	// Position in bottom right corner
	const left = termWidth - ALERT_WIDTH - 2
	const bottom = 4 // Above the footer

	return (
		<box
			style={{
				position: "absolute",
				left,
				top: termHeight - bottom - alerts.length * 3,
				flexDirection: "column",
			}}
		>
			{alerts.map((alert) => (
				<AlertItem key={alert.id} alert={alert} />
			))}
		</box>
	)
}

