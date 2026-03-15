import { readFileSync } from "fs"

export type Hunk =
	| { type: "add"; path: string; contents: string }
	| { type: "delete"; path: string }
	| { type: "update"; path: string; movePath?: string; chunks: UpdateChunk[] }

export interface UpdateChunk {
	oldLines: string[]
	newLines: string[]
	context?: string
	eof?: boolean
}

function stripHeredoc(input: string): string {
	const m = input.match(/^(?:cat\s+)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/)
	if (!m) return input
	return m[2]!
}

function header(
	lines: string[],
	idx: number,
): { path: string; movePath?: string; next: number } | undefined {
	const line = lines[idx]
	if (!line) return undefined
	if (line.startsWith("*** Add File:")) {
		const path = line.slice("*** Add File:".length).trim()
		if (!path) return undefined
		return { path, next: idx + 1 }
	}
	if (line.startsWith("*** Delete File:")) {
		const path = line.slice("*** Delete File:".length).trim()
		if (!path) return undefined
		return { path, next: idx + 1 }
	}
	if (line.startsWith("*** Update File:")) {
		const path = line.slice("*** Update File:".length).trim()
		if (!path) return undefined
		let next = idx + 1
		let movePath: string | undefined
		if (lines[next]?.startsWith("*** Move to:")) {
			movePath = lines[next]!.slice("*** Move to:".length).trim()
			next++
		}
		return { path, movePath, next }
	}
	return undefined
}

function parseAdd(
	lines: string[],
	idx: number,
): { content: string; next: number } {
	let out = ""
	let i = idx
	while (i < lines.length && !lines[i]!.startsWith("***")) {
		if (!lines[i]!.startsWith("+")) {
			throw new Error(
				`Invalid add-file line (must start with '+'): ${lines[i]}`,
			)
		}
		out += `${lines[i]!.slice(1)}\n`
		i++
	}
	if (out.endsWith("\n")) out = out.slice(0, -1)
	return { content: out, next: i }
}

function parseChunks(
	lines: string[],
	idx: number,
): { chunks: UpdateChunk[]; next: number } {
	const chunks: UpdateChunk[] = []
	let i = idx
	while (i < lines.length && !lines[i]!.startsWith("***")) {
		if (!lines[i]!.startsWith("@@")) {
			throw new Error(`Expected '@@' chunk header, got: ${lines[i]}`)
		}
		const ctx = lines[i]!.slice(2).trim()
		i++
		const oldLines: string[] = []
		const newLines: string[] = []
		let eof = false
		while (
			i < lines.length &&
			!lines[i]!.startsWith("@@") &&
			!lines[i]!.startsWith("***")
		) {
			const line = lines[i]!
			if (line === "*** End of File") {
				eof = true
				i++
				break
			}
			if (line.startsWith(" ")) {
				const txt = line.slice(1)
				oldLines.push(txt)
				newLines.push(txt)
				i++
				continue
			}
			if (line.startsWith("-")) {
				oldLines.push(line.slice(1))
				i++
				continue
			}
			if (line.startsWith("+")) {
				newLines.push(line.slice(1))
				i++
				continue
			}
			throw new Error(`Invalid update-file line prefix: ${line}`)
		}
		chunks.push({
			oldLines,
			newLines,
			context: ctx || undefined,
			eof: eof || undefined,
		})
	}
	if (chunks.length === 0) {
		throw new Error("Update file block contains no chunks")
	}
	return { chunks, next: i }
}

export function parsePatch(text: string): Hunk[] {
	const cleaned = stripHeredoc(text.trim())
	const lines = cleaned.split("\n")
	const begin = lines.findIndex((x) => x === "*** Begin Patch")
	const end = lines.findIndex((x) => x === "*** End Patch")
	if (begin === -1 || end === -1 || begin >= end) {
		throw new Error("Invalid patch format: missing Begin/End markers")
	}
	if (begin !== 0 || end !== lines.length - 1) {
		throw new Error(
			"Invalid patch format: Begin/End markers must wrap the full patch body",
		)
	}

	const hunks: Hunk[] = []
	let i = begin + 1
	while (i < end) {
		const h = header(lines, i)
		if (!h) {
			throw new Error(`Invalid patch block header: ${lines[i]}`)
		}
		if (lines[i]!.startsWith("*** Add File:")) {
			const parsed = parseAdd(lines, h.next)
			hunks.push({ type: "add", path: h.path, contents: parsed.content })
			i = parsed.next
			continue
		}
		if (lines[i]!.startsWith("*** Delete File:")) {
			hunks.push({ type: "delete", path: h.path })
			i = h.next
			continue
		}
		if (lines[i]!.startsWith("*** Update File:")) {
			const parsed = parseChunks(lines, h.next)
			hunks.push({
				type: "update",
				path: h.path,
				movePath: h.movePath,
				chunks: parsed.chunks,
			})
			i = parsed.next
			continue
		}
		i++
	}
	if (hunks.length === 0) {
		throw new Error("Invalid patch format: no hunks found")
	}
	return hunks
}

function norm(text: string): string {
	return text
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
		.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
		.replace(/\u2026/g, "...")
		.replace(/\u00A0/g, " ")
}

function seek(
	lines: string[],
	pat: string[],
	start: number,
	eof = false,
): number {
	if (pat.length === 0) return -1
	const modes = [
		(a: string, b: string) => a === b,
		(a: string, b: string) => a.trimEnd() === b.trimEnd(),
		(a: string, b: string) => a.trim() === b.trim(),
		(a: string, b: string) => norm(a.trim()) === norm(b.trim()),
	]

	for (const cmp of modes) {
		if (eof) {
			const from = lines.length - pat.length
			if (from >= start) {
				let ok = true
				for (let j = 0; j < pat.length; j++) {
					if (!cmp(lines[from + j]!, pat[j]!)) {
						ok = false
						break
					}
				}
				if (ok) return from
			}
		}
		for (let i = start; i <= lines.length - pat.length; i++) {
			let ok = true
			for (let j = 0; j < pat.length; j++) {
				if (!cmp(lines[i + j]!, pat[j]!)) {
					ok = false
					break
				}
			}
			if (ok) return i
		}
	}
	return -1
}

export function deriveNewContentsFromChunks(
	filepath: string,
	chunks: UpdateChunk[],
): string {
	const raw = readFileSync(filepath, "utf-8")
	let lines = raw.split("\n")
	if (lines.at(-1) === "") lines = lines.slice(0, -1)
	const rep: Array<[number, number, string[]]> = []
	let idx = 0

	for (const chunk of chunks) {
		if (chunk.context) {
			const pos = seek(lines, [chunk.context], idx)
			if (pos === -1) {
				throw new Error(
					`Failed to find context '${chunk.context}' in ${filepath}`,
				)
			}
			idx = pos + 1
		}

		if (chunk.oldLines.length === 0) {
			const ins =
				lines.length > 0 && lines[lines.length - 1] === ""
					? lines.length - 1
					: lines.length
			rep.push([ins, 0, chunk.newLines])
			continue
		}

		let oldLines = chunk.oldLines
		let newLines = chunk.newLines
		let pos = seek(lines, oldLines, idx, chunk.eof)
		if (pos === -1 && oldLines.at(-1) === "") {
			oldLines = oldLines.slice(0, -1)
			if (newLines.at(-1) === "") newLines = newLines.slice(0, -1)
			pos = seek(lines, oldLines, idx, chunk.eof)
		}
		if (pos === -1) {
			throw new Error(
				`Failed to find expected lines in ${filepath}:\n${chunk.oldLines.join("\n")}`,
			)
		}
		rep.push([pos, oldLines.length, newLines])
		idx = pos + oldLines.length
	}

	rep.sort((a, b) => a[0] - b[0])
	const out = [...lines]
	for (let i = rep.length - 1; i >= 0; i--) {
		const [start, oldLen, next] = rep[i]!
		out.splice(start, oldLen, ...next)
	}
	if (out.length === 0 || out.at(-1) !== "") out.push("")
	return out.join("\n")
}
