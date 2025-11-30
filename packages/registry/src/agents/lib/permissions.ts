/**
 * Permission level for a tool operation.
 * - "allow": Auto-approve, no user confirmation needed
 * - "deny": Block the operation entirely
 * - "ask": Require user approval before proceeding
 */
export type Permission = "allow" | "deny" | "ask"

/**
 * Permission configuration for all tools.
 */
export interface ToolPermissions {
	/** Bash command patterns (e.g., "ls*": "allow") */
	bash?: Record<string, Permission>
	/** Edit file path patterns */
	edit?: Permission | Record<string, Permission>
	/** Write file path patterns */
	write?: Permission | Record<string, Permission>
	/** Operations on files outside working directory */
	externalDirectory?: Permission
}

/**
 * Default bash permissions - auto-allow safe read-only commands.
 */
export const DEFAULT_BASH_PERMISSIONS: Record<string, Permission> = {
	// File listing and info
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

	// Search commands
	"grep*": "allow",
	"rg*": "allow",
	"find*": "allow",
	"tree*": "allow",
	"which*": "allow",
	"whereis*": "allow",

	// Text processing (read-only)
	"sort*": "allow",
	"uniq*": "allow",
	"cut*": "allow",
	"diff*": "allow",

	// Git read-only commands
	"git status*": "allow",
	"git diff*": "allow",
	"git log*": "allow",
	"git show*": "allow",
	"git branch": "allow",
	"git branch -v": "allow",
	"git branch -a": "allow",
	"git remote -v": "allow",

	// Dangerous commands - explicitly deny
	"rm -rf /*": "deny",
	"rm -rf /": "deny",
	"sudo rm*": "deny",
	"chmod 777*": "deny",

	// Everything else requires approval
	"*": "ask",
}

/**
 * Default file permissions for edit/write operations.
 */
export const DEFAULT_FILE_PERMISSIONS: Record<string, Permission> = {
	"*": "ask",
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
	patterns: Record<string, Permission>,
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

