import { promises as fs } from "fs"

const reads = new Map<string, Map<string, number>>()
const seen = new Map<string, number>()
const MAX_SCOPES = 512
const MAX_AGE_MS = 6 * 60 * 60 * 1000

function bucket(scope: string): Map<string, number> {
	seen.set(scope, Date.now())
	const hit = reads.get(scope)
	if (hit) return hit
	const next = new Map<string, number>()
	reads.set(scope, next)
	cleanupReads()
	return next
}

export function cleanupReads(now = Date.now()): void {
	for (const [scope, at] of seen) {
		if (now - at <= MAX_AGE_MS) continue
		reads.delete(scope)
		seen.delete(scope)
	}
	if (reads.size <= MAX_SCOPES) return
	const sorted = Array.from(seen.entries()).sort((a, b) => a[1] - b[1])
	const drop = reads.size - MAX_SCOPES
	for (let i = 0; i < drop; i++) {
		const scope = sorted[i]?.[0]
		if (!scope) continue
		reads.delete(scope)
		seen.delete(scope)
	}
}

export async function markRead(scope: string, filepath: string): Promise<void> {
	const stat = await fs.stat(filepath)
	bucket(scope).set(filepath, stat.mtimeMs)
}

export async function assertFreshRead(scope: string, filepath: string): Promise<void> {
	const prev = bucket(scope).get(filepath)
	if (prev === undefined) {
		throw new Error(`File ${filepath} must be read before editing. Use the Read tool first.`)
	}

	const stat = await fs.stat(filepath)
	if (stat.mtimeMs !== prev) {
		throw new Error(`File ${filepath} changed after it was read. Read it again before editing.`)
	}
}

export function clearReads(scope?: string): void {
	if (scope) {
		reads.delete(scope)
		seen.delete(scope)
	} else {
		reads.clear()
		seen.clear()
	}
}
