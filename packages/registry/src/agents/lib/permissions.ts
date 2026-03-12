/**
 * Permission level for a tool operation.
 * - "allow": Auto-approve, no user confirmation needed
 * - "deny": Block the operation entirely
 * - "ask": Require user approval before proceeding
 */
export type Permission = "allow" | "deny" | "ask"
export type PermissionPatterns = Record<string, Permission>
export type SupportedSubagentType =
	| "coding-agent"
	| "planning-agent"
	| "research-agent"

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

/** Dangerous commands that should always be denied */
export const DANGEROUS_COMMANDS: PermissionPatterns = {
	"rm -rf /*": "deny",
	"rm -rf /": "deny",
	"sudo rm*": "deny",
	"chmod 777*": "deny",
}

/** Full bash access with dangerous command guards. Requires user approval for unknown commands. */
export const FULL_BASH_PERMISSIONS: PermissionPatterns = {
	...FILE_READ_COMMANDS,
	...SEARCH_COMMANDS,
	...TEXT_PROCESSING_COMMANDS,
	...GIT_READ_COMMANDS,
	...DANGEROUS_COMMANDS,
	"*": "ask",
}

/** Read-only bash access. Denies any command not explicitly allowed. */
export const READONLY_BASH_PERMISSIONS: PermissionPatterns = {
	...FILE_READ_COMMANDS,
	...SEARCH_COMMANDS,
	...TEXT_PROCESSING_COMMANDS,
	...GIT_READ_COMMANDS,
	"*": "deny",
}

/**
 * Default subagent task permissions.
 * Known in-product agent types are auto-allowed; unknown task types require approval.
 */
export const DEFAULT_TASK_PERMISSIONS: PermissionPatterns = {
	"coding-agent": "allow",
	"planning-agent": "allow",
	"research-agent": "allow",
	"*": "ask",
}

/**
 * Merge permission maps where override patterns replace base patterns.
 */
export function mergePermissionPatterns(
	base: PermissionPatterns,
	override?: PermissionPatterns,
): PermissionPatterns {
	if (!override) {
		return { ...base }
	}
	return {
		...base,
		...override,
	}
}

/**
 * Match a value against a wildcard pattern.
 *
 * @param value - The string to test
 * @param pattern - The pattern with optional wildcards (*)
 *
 * @example
 * matchWildcard("ls -la", "ls*") // true
 * matchWildcard("git diff HEAD", "git diff*") // true
 * matchWildcard("rm -rf /", "*") // true
 */
export function matchWildcard(value: string, pattern: string): boolean {
	if (pattern === "*") return true

	// Escape regex special chars except *
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
	// Convert * to .* for regex matching
	const regex = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`)
	return regex.test(value)
}

/**
 * Check permission for a value against a set of patterns.
 *
 * Patterns are checked from most specific to least specific:
 * 1. Exact matches (no wildcards) first
 * 2. Longer patterns before shorter ones
 * 3. Wildcard-only pattern (*) last
 *
 * @param value - The value to check (command, file path, etc.)
 * @param patterns - Pattern-to-permission mapping
 * @returns The permission level for this value
 *
 * @example
 * checkPermission("ls -la", { "ls*": "allow", "*": "ask" }) // "allow"
 * checkPermission("npm install", { "ls*": "allow", "*": "ask" }) // "ask"
 */
export function checkPermission(
	value: string,
	patterns: PermissionPatterns,
): Permission {
	// Sort patterns from most specific to least specific
	const sortedPatterns = Object.keys(patterns).sort((a, b) => {
		// Exact matches (no wildcards) come first
		const aHasWildcard = a.includes("*")
		const bHasWildcard = b.includes("*")
		if (!aHasWildcard && bHasWildcard) return -1
		if (aHasWildcard && !bHasWildcard) return 1

		// Wildcard-only pattern comes last
		if (a === "*") return 1
		if (b === "*") return -1

		// Longer patterns are more specific
		return b.length - a.length
	})

	for (const pattern of sortedPatterns) {
		if (matchWildcard(value, pattern)) {
			return patterns[pattern]!
		}
	}

	// Default to ask if no pattern matches
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
