import { platform } from "os"

/**
 * Copy text to the system clipboard.
 * Uses platform-specific tools: pbcopy on macOS, wl-copy/xclip on Linux, PowerShell on Windows.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	const os = platform()

	try {
		if (os === "darwin") {
			const proc = Bun.spawn(["pbcopy"], {
				stdin: "pipe",
				stdout: "ignore",
				stderr: "ignore",
			})
			proc.stdin.write(text)
			proc.stdin.end()
			await proc.exited
			return true
		}

		if (os === "linux") {
			// Try Wayland first
			if (process.env.WAYLAND_DISPLAY && Bun.which("wl-copy")) {
				const proc = Bun.spawn(["wl-copy"], {
					stdin: "pipe",
					stdout: "ignore",
					stderr: "ignore",
				})
				proc.stdin.write(text)
				proc.stdin.end()
				await proc.exited
				return true
			}

			// Fall back to xclip
			if (Bun.which("xclip")) {
				const proc = Bun.spawn(["xclip", "-selection", "clipboard"], {
					stdin: "pipe",
					stdout: "ignore",
					stderr: "ignore",
				})
				proc.stdin.write(text)
				proc.stdin.end()
				await proc.exited
				return true
			}

			// Fall back to xsel
			if (Bun.which("xsel")) {
				const proc = Bun.spawn(["xsel", "--clipboard", "--input"], {
					stdin: "pipe",
					stdout: "ignore",
					stderr: "ignore",
				})
				proc.stdin.write(text)
				proc.stdin.end()
				await proc.exited
				return true
			}
		}

		if (os === "win32") {
			const escaped = text.replace(/"/g, '""')
			const proc = Bun.spawn(
				["powershell", "-command", `Set-Clipboard -Value "${escaped}"`],
				{ stdout: "ignore", stderr: "ignore" },
			)
			await proc.exited
			return true
		}

		return false
	} catch {
		return false
	}
}
