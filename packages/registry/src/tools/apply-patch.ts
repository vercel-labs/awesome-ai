import { tool } from "ai"
import { createTwoFilesPatch, diffLines } from "diff"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import {
	checkPermission,
	type Permission,
	PermissionDeniedError,
} from "@/agents/lib/permissions"
import { deriveNewContentsFromChunks, parsePatch } from "@/tools/lib/patch"
import { toolOutput } from "@/tools/lib/tool-output"
import { trimDiff } from "@/tools/lib/trim-diff"

const description = `Applies codex-style unified patches to files.

Patch format:
- Must include "*** Begin Patch" and "*** End Patch"
- Supports "*** Add File:", "*** Update File:", "*** Delete File:"
- Update hunks use "@@" with lines prefixed by " ", "-", "+"
- Optional "*** Move to:" after "*** Update File:"

Use this tool for precise edits across one or more files.`

const inputSchema = z.object({
	patchText: z.string().describe("The full patch text to apply"),
})

const outputSchema = toolOutput({
	pending: {
		patchText: z.string(),
		result: z.undefined(),
	},
	success: {
		result: z.string(),
		diff: z.string(),
		files: z.array(z.string()),
	},
	error: {
		patchText: z.string(),
	},
})

export function createApplyPatchTool(
	permissions: Permission | Record<string, Permission> = "ask",
) {
	const patterns = typeof permissions === "string" ? { "*": permissions } : permissions

	return tool({
		description,
		inputSchema,
		outputSchema,
		needsApproval: ({ patchText }) => {
			let hunks = [] as ReturnType<typeof parsePatch>
			try {
				hunks = parsePatch(patchText)
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error)
				throw new Error(`apply_patch verification failed: ${msg}`)
			}
			let ask = false
			for (const hunk of hunks) {
				const targets = [path.resolve(process.cwd(), hunk.path)]
				if (hunk.type === "update" && hunk.movePath) {
					targets.push(path.resolve(process.cwd(), hunk.movePath))
				}
				for (const target of targets) {
					const permission = checkPermission(target, patterns)
					if (permission === "deny") {
						throw new PermissionDeniedError("apply_patch", target)
					}
					if (permission === "ask") ask = true
				}
			}
			return ask
		},
		toModelOutput: ({ output }) => {
			if (output.status === "error") {
				return {
					type: "error-text",
					value: `Failed to apply patch: ${output.error}`,
				}
			}
			if (output.status === "success") {
				return { type: "text", value: output.result }
			}
			throw new Error("Invalid output status in toModelOutput")
		},
		async *execute({ patchText }) {
			yield {
				status: "pending",
				message: "Applying patch",
				patchText,
				result: undefined,
			}

			try {
				let hunks = [] as ReturnType<typeof parsePatch>
				try {
					hunks = parsePatch(patchText)
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error)
					throw new Error(`apply_patch verification failed: ${msg}`)
				}

				let diff = ""
				const files: string[] = []

				for (const hunk of hunks) {
					if (hunk.type === "add") {
						const filepath = path.resolve(process.cwd(), hunk.path)
						await fs.mkdir(path.dirname(filepath), { recursive: true })
						const next = hunk.contents.endsWith("\n")
							? hunk.contents
							: `${hunk.contents}\n`
						await fs.writeFile(filepath, next, "utf-8")
						diff += `${trimDiff(createTwoFilesPatch(filepath, filepath, "", next))}\n`
						files.push(filepath)
						continue
					}

					if (hunk.type === "delete") {
						const filepath = path.resolve(process.cwd(), hunk.path)
						const prev = await fs.readFile(filepath, "utf-8")
						await fs.unlink(filepath)
						diff += `${trimDiff(createTwoFilesPatch(filepath, filepath, prev, ""))}\n`
						files.push(filepath)
						continue
					}

					const filepath = path.resolve(process.cwd(), hunk.path)
					const prev = await fs.readFile(filepath, "utf-8")
					let next = ""
					try {
						next = deriveNewContentsFromChunks(filepath, hunk.chunks)
					} catch (error) {
						const msg = error instanceof Error ? error.message : String(error)
						throw new Error(`apply_patch verification failed: ${msg}`)
					}
					const target = hunk.movePath
						? path.resolve(process.cwd(), hunk.movePath)
						: filepath
					await fs.mkdir(path.dirname(target), { recursive: true })
					await fs.writeFile(target, next, "utf-8")
					if (target !== filepath) {
						await fs.unlink(filepath)
					}
					diff += `${trimDiff(createTwoFilesPatch(target, target, prev, next))}\n`
					files.push(target)
				}

				let added = 0
				let removed = 0
				for (const part of diffLines("", diff)) {
					if (part.added) added += part.count ?? 0
					if (part.removed) removed += part.count ?? 0
				}

				yield {
					status: "success",
					message: `Applied patch to ${files.length} files`,
					result: `Success. Updated ${files.length} files (+${added}/-${removed}).`,
					diff: diff.trim(),
					files,
				}
			} catch (error) {
				yield {
					status: "error",
					message: "Failed to apply patch",
					patchText,
					error: error instanceof Error ? error.message : String(error),
				}
			}
		},
	})
}

export const applyPatchTool = createApplyPatchTool()
