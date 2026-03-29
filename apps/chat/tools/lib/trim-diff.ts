export function trimDiff(diff: string): string {
	const lines = diff.split("\n")
	const contentLines = lines.filter(
		(line) =>
			(line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
			!line.startsWith("---") &&
			!line.startsWith("+++"),
	)

	if (contentLines.length === 0) return diff

	let min = Infinity
	for (const line of contentLines) {
		const content = line.slice(1)
		if (content.trim().length > 0) {
			const match = content.match(/^(\s*)/)
			if (match) min = Math.min(min, match[1]!.length)
		}
	}

	if (min === Infinity || min === 0) return diff

	const trimmedLines = lines.map((line) => {
		if (
			(line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
			!line.startsWith("---") &&
			!line.startsWith("+++")
		) {
			const prefix = line[0]
			const content = line.slice(1)
			return prefix + content.slice(min)
		}
		return line
	})

	return trimmedLines.join("\n")
}
