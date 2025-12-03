import { useEffect, useState } from "react"
import { colors } from "../../theme"

const CURSOR_FRAMES = ["▊", " "]

interface StreamingIndicatorProps {
	color?: string
}

export function StreamingIndicator({
	color = colors.green,
}: StreamingIndicatorProps) {
	const [frame, setFrame] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setFrame((f) => (f + 1) % CURSOR_FRAMES.length)
		}, 530) // Typical cursor blink rate

		return () => clearInterval(interval)
	}, [])

	return <text fg={color}>{CURSOR_FRAMES[frame]}</text>
}
