export type Permission = "allow" | "deny" | "ask"
export type PermissionPatterns = Record<string, Permission>
export type SupportedSubagentType = "coding-agent" | "planning-agent" | "research-agent"

export interface AgentGovernanceConfig {
	taskPermissions?: PermissionPatterns
}

export const FILE_READ_COMMANDS: PermissionPatterns = {
	"ls*": "allow",
	"pwd*": "allow",
	"cat*": "allow",
	"head*": "allow",
	"tail*": "allow",
	"less*": "allow",
	"more*": "allow",
	"wc*": "allow",
	"file*": "allow",
	"stat*": "allow",
	"du*": "allow",
}

export const SEARCH_COMMANDS: PermissionPatterns = {
	"grep*": "allow",
	"rg*": "allow",
	"find*": "allow",
	"tree*": "allow",
	"which*": "allow",
	"whereis*": "allow",
}

export const TEXT_PROCESSING_COMMANDS: PermissionPatterns = {
	"sort*": "allow",
	"uniq*": "allow",
	"cut*": "allow",
	"diff*": "allow",
}

export const GIT_READ_COMMANDS: PermissionPatterns = {
	"git status*": "allow",
	"git diff*": "allow",
	"git log*": "allow",
	"git show*": "allow",
	"git branch": "allow",
	"git branch -v": "allow",
	"git branch -a": "allow",
	"git remote -v": "allow",
	"git blame*": "allow",
}

export const DANGEROUS_COMMANDS: PermissionPatterns = {
	"rm -rf /*": "deny",
	"rm -rf /": "deny",
	"sudo rm*": "deny",
	"chmod 777*": "deny",
}

export const FULL_BASH_PERMISSIONS: PermissionPatterns = {
	...FILE_READ_COMMANDS,
	...SEARCH_COMMANDS,
	...TEXT_PROCESSING_COMMANDS,
	...GIT_READ_COMMANDS,
	...DANGEROUS_COMMANDS,
	"*": "ask",
}

export const READONLY_BASH_PERMISSIONS: PermissionPatterns = {
	...FILE_READ_COMMANDS,
	...SEARCH_COMMANDS,
	...TEXT_PROCESSING_COMMANDS,
	...GIT_READ_COMMANDS,
	"*": "deny",
}

export const DEFAULT_TASK_PERMISSIONS: PermissionPatterns = {
	"coding-agent": "allow",
	"planning-agent": "allow",
	"research-agent": "allow",
	"*": "ask",
}

export function mergePermissionPatterns(
	base: PermissionPatterns,
	override?: PermissionPatterns,
): PermissionPatterns {
	if (!override) return { ...base }
	return { ...base, ...override }
}

export function matchWildcard(value: string, pattern: string): boolean {
	if (pattern === "*") return true
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
	const regex = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`)
	return regex.test(value)
}

export function checkPermission(value: string, patterns: PermissionPatterns): Permission {
	const sortedPatterns = Object.keys(patterns).sort((a, b) => {
		const aHasWildcard = a.includes("*")
		const bHasWildcard = b.includes("*")
		if (!aHasWildcard && bHasWildcard) return -1
		if (aHasWildcard && !bHasWildcard) return 1
		if (a === "*") return 1
		if (b === "*") return -1
		return b.length - a.length
	})

	for (const pattern of sortedPatterns) {
		if (matchWildcard(value, pattern)) {
			return patterns[pattern]!
		}
	}
	return "ask"
}

export class PermissionDeniedError extends Error {
	constructor(
		public readonly operation: string,
		public readonly value: string,
	) {
		super(`Permission denied: ${operation} "${value}" is not allowed`)
		this.name = "PermissionDeniedError"
	}
}
