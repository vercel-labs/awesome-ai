import { useEffect, useState } from "react"
import { colors } from "../../theme"

const FRAMES = ["·  ", "•  ", "·  ", " · ", " • ", " · ", "  ·", "  •", "  ·"]

interface AnimatedDotsProps {
	label: string
	color?: string
}

export function AnimatedDots({ label, color = colors.muted }: AnimatedDotsProps) {
	const [frame, setFrame] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setFrame((f) => (f + 1) % FRAMES.length)
		}, 150)

		return () => clearInterval(interval)
	}, [])

	return (
		<text fg={color}>
			{label}
			{FRAMES[frame]}
		</text>
	)
}
