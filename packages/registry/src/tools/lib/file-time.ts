import { promises as fs } from "fs"

const reads = new Map<string, Map<string, number>>()

function bucket(scope: string): Map<string, number> {
	const hit = reads.get(scope)
	if (hit) return hit
	const next = new Map<string, number>()
	reads.set(scope, next)
	return next
}

export async function markRead(scope: string, filepath: string): Promise<void> {
	const stat = await fs.stat(filepath)
	bucket(scope).set(filepath, stat.mtimeMs)
}

export async function assertFreshRead(scope: string, filepath: string): Promise<void> {
	const prev = bucket(scope).get(filepath)
	if (prev === undefined) {
		throw new Error(
			`File ${filepath} must be read before editing. Use the Read tool first.`,
		)
	}

	const stat = await fs.stat(filepath)
	if (stat.mtimeMs !== prev) {
		throw new Error(
			`File ${filepath} changed after it was read. Read it again before editing.`,
		)
	}
}

export function clearReads(scope?: string): void {
	if (scope) {
		reads.delete(scope)
	} else {
		reads.clear()
	}
}
