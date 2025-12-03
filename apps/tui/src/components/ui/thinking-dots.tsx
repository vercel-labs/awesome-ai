import { useEffect, useState } from "react"
import { colors } from "../../theme"

// Dot animation frames - dots bounce up one at a time
const FRAMES = ["·  ", "•  ", "·  ", " · ", " • ", " · ", "  ·", "  •", "  ·"]

interface ThinkingDotsProps {
	color?: string
}

export function ThinkingDots({ color = colors.muted }: ThinkingDotsProps) {
	const [frame, setFrame] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setFrame((f) => (f + 1) % FRAMES.length)
		}, 150)

		return () => clearInterval(interval)
	}, [])

	return <text fg={color}>thinking{FRAMES[frame]}</text>
}

