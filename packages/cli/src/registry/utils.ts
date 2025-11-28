export function isUrl(string: string): boolean {
	try {
		new URL(string)
		return true
	} catch {
		return false
	}
}

export function isLocalFile(string: string): boolean {
	return (
		string.startsWith("file://") ||
		string.startsWith("./") ||
		string.startsWith("../") ||
		string.startsWith("/")
	)
}
