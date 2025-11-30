import { execSync } from "child_process"
import { existsSync } from "fs"
import { readdir, readFile, stat } from "fs/promises"
import { homedir } from "os"
import { dirname, join } from "path"

export interface EnvironmentContext {
	workingDirectory: string
	platform: string
	date: string
	isGitRepo: boolean
	fileTree?: string
	customRules?: string[]
}

export interface EnvironmentOptions {
	cwd?: string
	includeFileTree?: boolean
	fileTreeLimit?: number
	includeCustomRules?: boolean
	customRuleFiles?: string[]
}

function detectGitRepo(cwd: string): boolean {
	try {
		execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "pipe" })
		return true
	} catch {
		return false
	}
}

async function generateFileTree(cwd: string, limit = 200): Promise<string> {
	try {
		const output = execSync(
			"git ls-files --cached --others --exclude-standard",
			{ cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
		)
		return output.trim().split("\n").filter(Boolean).slice(0, limit).join("\n")
	} catch {
		const files = await walkDirectory(cwd, limit)
		return files.join("\n")
	}
}

const IGNORE_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"__pycache__",
	".turbo",
	".cache",
	"coverage",
])

async function walkDirectory(
	dir: string,
	limit: number,
	prefix = "",
): Promise<string[]> {
	try {
		const entries = await readdir(dir)
		const filtered = entries.filter(
			(e) => !IGNORE_DIRS.has(e) && !e.startsWith("."),
		)

		const results = await Promise.all(
			filtered.map(async (entry) => {
				const fullPath = join(dir, entry)
				const relativePath = prefix ? `${prefix}/${entry}` : entry

				try {
					const s = await stat(fullPath)
					if (s.isDirectory()) {
						return walkDirectory(fullPath, limit, relativePath)
					}
					return [relativePath]
				} catch {
					return []
				}
			}),
		)

		return results.flat().slice(0, limit)
	} catch {
		return []
	}
}

const DEFAULT_RULE_FILES = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md"]
const GLOBAL_RULE_PATHS = [
	join(homedir(), ".config", "agents", "AGENTS.md"),
	join(homedir(), ".claude", "CLAUDE.md"),
]

async function loadCustomRules(
	cwd: string,
	additionalFiles: string[] = [],
): Promise<string[]> {
	const ruleFiles = [...DEFAULT_RULE_FILES, ...additionalFiles]
	const found = new Set<string>()
	const paths: Array<{ path: string; isGlobal: boolean }> = []

	let dir = cwd
	const root = dirname(dir)
	while (dir !== root) {
		for (const file of ruleFiles) {
			const filePath = join(dir, file)
			if (!found.has(filePath) && existsSync(filePath)) {
				paths.push({ path: filePath, isGlobal: false })
				found.add(filePath)
			}
		}
		dir = dirname(dir)
	}

	for (const filePath of GLOBAL_RULE_PATHS) {
		if (!found.has(filePath) && existsSync(filePath)) {
			paths.push({ path: filePath, isGlobal: true })
			found.add(filePath)
		}
	}

	const results = await Promise.all(
		paths.map(async ({ path, isGlobal }) => {
			try {
				const content = await readFile(path, "utf-8")
				const prefix = isGlobal ? "Global instructions" : "Instructions"
				return `# ${prefix} from ${path}\n\n${content}`
			} catch {
				return null
			}
		}),
	)

	return results.filter((r) => r !== null)
}

/**
 * Gathers rich environment context for the agent's system prompt.
 * Includes working directory, platform, git status, file tree, and custom rules (AGENTS.md, etc.).
 */
export async function getEnvironmentContext(
	options: EnvironmentOptions = {},
): Promise<EnvironmentContext> {
	const {
		cwd = process.cwd(),
		includeFileTree = true,
		fileTreeLimit = 200,
		includeCustomRules = true,
		customRuleFiles = [],
	} = options

	const isGitRepo = detectGitRepo(cwd)

	const [fileTree, customRules] = await Promise.all([
		includeFileTree ? generateFileTree(cwd, fileTreeLimit) : undefined,
		includeCustomRules ? loadCustomRules(cwd, customRuleFiles) : undefined,
	])

	return {
		workingDirectory: cwd,
		platform: process.platform,
		date: new Date().toDateString(),
		isGitRepo,
		fileTree,
		customRules,
	}
}
