import { describe, expect, it } from "vitest"
import {
	checkPermission,
	DEFAULT_TASK_PERMISSIONS,
	matchWildcard,
	mergePermissionPatterns,
} from "../permissions"

describe("matchWildcard", () => {
	it("matches exact strings", () => {
		expect(matchWildcard("hello", "hello")).toBe(true)
		expect(matchWildcard("hello", "world")).toBe(false)
	})

	it("matches wildcard at end", () => {
		expect(matchWildcard("ls -la", "ls*")).toBe(true)
		expect(matchWildcard("ls", "ls*")).toBe(true)
		expect(matchWildcard("cat file", "ls*")).toBe(false)
	})

	it("matches wildcard at start", () => {
		expect(matchWildcard("test.ts", "*.ts")).toBe(true)
		expect(matchWildcard("foo/bar.ts", "*.ts")).toBe(true)
		expect(matchWildcard("test.js", "*.ts")).toBe(false)
	})

	it("matches universal wildcard", () => {
		expect(matchWildcard("anything", "*")).toBe(true)
		expect(matchWildcard("", "*")).toBe(true)
	})

	it("escapes regex special characters", () => {
		expect(matchWildcard("file.ts", "file.ts")).toBe(true)
		expect(matchWildcard("filexts", "file.ts")).toBe(false)
	})
})

describe("checkPermission", () => {
	it("returns matching permission for exact pattern", () => {
		const patterns = { "ls -la": "allow" as const }
		expect(checkPermission("ls -la", patterns)).toBe("allow")
	})

	it("returns matching permission for wildcard pattern", () => {
		const patterns = { "cat*": "allow" as const }
		expect(checkPermission("cat file.txt", patterns)).toBe("allow")
	})

	it("returns 'ask' when no pattern matches", () => {
		const patterns = { "ls*": "allow" as const }
		expect(checkPermission("rm -rf", patterns)).toBe("ask")
	})

	it("prioritizes exact matches over wildcards", () => {
		const patterns = {
			"git status": "deny" as const,
			"git*": "allow" as const,
		}
		expect(checkPermission("git status", patterns)).toBe("deny")
		expect(checkPermission("git diff", patterns)).toBe("allow")
	})

	it("prioritizes longer patterns over shorter ones", () => {
		const patterns = {
			"*": "deny" as const,
			"git*": "ask" as const,
			"git status*": "allow" as const,
		}
		expect(checkPermission("git status --short", patterns)).toBe("allow")
		expect(checkPermission("git diff", patterns)).toBe("ask")
		expect(checkPermission("rm -rf", patterns)).toBe("deny")
	})

	it("supports default task permission policy", () => {
		expect(checkPermission("coding-agent", DEFAULT_TASK_PERMISSIONS)).toBe("allow")
		expect(checkPermission("planning-agent", DEFAULT_TASK_PERMISSIONS)).toBe("allow")
		expect(checkPermission("custom-agent", DEFAULT_TASK_PERMISSIONS)).toBe("ask")
	})
})

describe("mergePermissionPatterns", () => {
	it("overrides specific patterns while keeping defaults", () => {
		const merged = mergePermissionPatterns(DEFAULT_TASK_PERMISSIONS, {
			"planning-agent": "deny",
		})
		expect(checkPermission("planning-agent", merged)).toBe("deny")
		expect(checkPermission("coding-agent", merged)).toBe("allow")
		expect(checkPermission("unknown-agent", merged)).toBe("ask")
	})

	it("supports constructor-style injected wildcard governance", () => {
		const injected = mergePermissionPatterns(DEFAULT_TASK_PERMISSIONS, {
			"research-*": "deny",
			"*": "ask",
		})
		expect(checkPermission("research-agent", injected)).toBe("allow")
		expect(checkPermission("research-helper", injected)).toBe("deny")
		expect(checkPermission("new-agent", injected)).toBe("ask")
	})
})
