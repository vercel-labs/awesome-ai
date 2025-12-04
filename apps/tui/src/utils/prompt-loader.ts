import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { debugLog } from "../components/atoms"

interface DiscoveredPrompt {
	name: string
	path: string
}

async function discoverPrompts(
	promptsPath: string,
): Promise<DiscoveredPrompt[]> {
	const prompts: DiscoveredPrompt[] = []

	try {
		const entries = await readdir(promptsPath)

		for (const entry of entries) {
			const entryPath = path.join(promptsPath, entry)
			const entryStat = await stat(entryPath)

			if (entryStat.isDirectory()) continue
			if (
				!entry.endsWith(".ts") &&
				!entry.endsWith(".tsx") &&
				!entry.endsWith(".js") &&
				!entry.endsWith(".jsx")
			) {
				continue
			}

			// Extract prompt name from filename (e.g., "coding-agent.ts" -> "coding-agent")
			const name = entry.replace(/\.(tsx?|jsx?)$/, "")

			prompts.push({
				name,
				path: entryPath,
			})
		}
	} catch {
		// Directory doesn't exist or can't be read
		return []
	}

	return prompts.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Load prompt content from a prompt module.
 * Prompts export a `prompt` function that returns a string.
 */
export async function loadPromptContent(
	promptsPath: string,
	promptName: string,
): Promise<string | null> {
	const prompts = await discoverPrompts(promptsPath)
	const promptInfo = prompts.find((p) => p.name === promptName)

	if (!promptInfo) {
		debugLog(`Prompt "${promptName}" not found in ${promptsPath}`)
		return null
	}

	try {
		const promptModule = await import(promptInfo.path)

		if (typeof promptModule.prompt === "function") {
			// Call with minimal context for preview purposes
			const result = promptModule.prompt({
				workingDirectory: process.cwd(),
				platform: process.platform,
				date: new Date().toLocaleDateString(),
				isGitRepo: false,
			})
			if (typeof result === "string") {
				return result
			}
		}

		debugLog(`No prompt function found in module ${promptName}`)
		return null
	} catch (error) {
		debugLog(`Failed to load prompt ${promptName}:`, error)
		return null
	}
}
