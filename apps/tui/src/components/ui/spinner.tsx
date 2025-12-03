import { useEffect, useState } from "react"
import { colors } from "../../theme"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

interface SpinnerProps {
	color?: string
}

export function Spinner({ color = colors.green }: SpinnerProps) {
	const [frame, setFrame] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setFrame((f) => (f + 1) % SPINNER_FRAMES.length)
		}, 100)

		return () => clearInterval(interval)
	}, [])

	return <text fg={color}>{SPINNER_FRAMES[frame]}</text>
}
