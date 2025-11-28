import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { files, search } from "../../lib/ripgrep"

// Helper to collect all values from an async generator
async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const results: T[] = []
	for await (const value of gen) {
		results.push(value)
	}
	return results
}

describe("ripgrep", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ripgrep-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("files", () => {
		it("lists files in a directory", async () => {
			await fs.writeFile(path.join(tempDir, "file1.txt"), "content1")
			await fs.writeFile(path.join(tempDir, "file2.txt"), "content2")

			const results = await collect(files({ cwd: tempDir }))

			expect(results).toHaveLength(2)
			expect(results.sort()).toEqual(["file1.txt", "file2.txt"])
		})

		it("lists files in nested directories", async () => {
			await fs.mkdir(path.join(tempDir, "subdir"), { recursive: true })
			await fs.writeFile(path.join(tempDir, "root.txt"), "root")
			await fs.writeFile(path.join(tempDir, "subdir", "nested.txt"), "nested")

			const results = await collect(files({ cwd: tempDir }))

			expect(results).toHaveLength(2)
			expect(results.sort()).toEqual(["root.txt", "subdir/nested.txt"])
		})

		it("includes hidden files", async () => {
			await fs.writeFile(path.join(tempDir, ".hidden"), "hidden content")
			await fs.writeFile(path.join(tempDir, "visible.txt"), "visible")

			const results = await collect(files({ cwd: tempDir }))

			expect(results).toHaveLength(2)
			expect(results).toContain(".hidden")
			expect(results).toContain("visible.txt")
		})

		it("filters with glob patterns", async () => {
			await fs.writeFile(path.join(tempDir, "file.txt"), "text")
			await fs.writeFile(path.join(tempDir, "file.js"), "js")
			await fs.writeFile(path.join(tempDir, "file.ts"), "ts")

			const results = await collect(
				files({ cwd: tempDir, glob: ["*.txt", "*.js"] }),
			)

			expect(results.sort()).toEqual(["file.js", "file.txt"])
		})

		it("excludes with negated glob patterns", async () => {
			await fs.writeFile(path.join(tempDir, "keep.txt"), "keep")
			await fs.writeFile(path.join(tempDir, "exclude.log"), "exclude")

			const results = await collect(files({ cwd: tempDir, glob: ["!*.log"] }))

			expect(results).toEqual(["keep.txt"])
		})

		it("returns empty for empty directory", async () => {
			const results = await collect(files({ cwd: tempDir }))

			expect(results).toHaveLength(0)
		})

		it("excludes .git directory by default", async () => {
			await fs.mkdir(path.join(tempDir, ".git"), { recursive: true })
			await fs.writeFile(path.join(tempDir, ".git", "config"), "git config")
			await fs.writeFile(path.join(tempDir, "source.txt"), "source")

			const results = await collect(files({ cwd: tempDir }))

			expect(results).toEqual(["source.txt"])
		})
	})

	describe("search", () => {
		it("finds pattern in files", async () => {
			await fs.writeFile(path.join(tempDir, "file.txt"), "hello world\nfoo bar")

			const results = await collect(
				search({ cwd: tempDir, pattern: "hello" }),
			)

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				path: "file.txt",
				lineNumber: 1,
				lineText: "hello world",
			})
		})

		it("finds multiple matches in same file", async () => {
			await fs.writeFile(
				path.join(tempDir, "file.txt"),
				"line one foo\nline two\nline three foo",
			)

			const results = await collect(search({ cwd: tempDir, pattern: "foo" }))

			expect(results).toHaveLength(2)
			expect(results[0]?.lineNumber).toBe(1)
			expect(results[1]?.lineNumber).toBe(3)
		})

		it("finds matches across multiple files", async () => {
			await fs.writeFile(path.join(tempDir, "a.txt"), "match here")
			await fs.writeFile(path.join(tempDir, "b.txt"), "match there")

			const results = await collect(search({ cwd: tempDir, pattern: "match" }))

			expect(results).toHaveLength(2)
			const paths = results.map((r) => r.path).sort()
			expect(paths).toEqual(["a.txt", "b.txt"])
		})

		it("supports regex patterns", async () => {
			await fs.writeFile(
				path.join(tempDir, "file.txt"),
				"foo123bar\nfoo456bar\nno match",
			)

			const results = await collect(
				search({ cwd: tempDir, pattern: "foo\\d+bar" }),
			)

			expect(results).toHaveLength(2)
		})

		it("filters with glob patterns", async () => {
			await fs.writeFile(path.join(tempDir, "code.ts"), "const match = 1")
			await fs.writeFile(path.join(tempDir, "code.js"), "const match = 2")

			const results = await collect(
				search({ cwd: tempDir, pattern: "match", glob: ["*.ts"] }),
			)

			expect(results).toHaveLength(1)
			expect(results[0]?.path).toBe("code.ts")
		})

		it("respects maxCount option", async () => {
			await fs.writeFile(
				path.join(tempDir, "file.txt"),
				"match1\nmatch2\nmatch3\nmatch4",
			)

			const results = await collect(
				search({ cwd: tempDir, pattern: "match", maxCount: 2 }),
			)

			expect(results).toHaveLength(2)
		})

		it("returns empty for no matches", async () => {
			await fs.writeFile(path.join(tempDir, "file.txt"), "no matching content")

			const results = await collect(
				search({ cwd: tempDir, pattern: "notfound" }),
			)

			expect(results).toHaveLength(0)
		})

		it("searches in nested directories", async () => {
			await fs.mkdir(path.join(tempDir, "subdir"), { recursive: true })
			await fs.writeFile(
				path.join(tempDir, "subdir", "nested.txt"),
				"nested match",
			)

			const results = await collect(search({ cwd: tempDir, pattern: "match" }))

			expect(results).toHaveLength(1)
			expect(results[0]?.path).toBe("subdir/nested.txt")
		})

		it("includes hidden files in search", async () => {
			await fs.writeFile(path.join(tempDir, ".hidden"), "secret match")

			const results = await collect(search({ cwd: tempDir, pattern: "match" }))

			expect(results).toHaveLength(1)
			expect(results[0]?.path).toBe(".hidden")
		})

		it("excludes .git directory by default", async () => {
			await fs.mkdir(path.join(tempDir, ".git"), { recursive: true })
			await fs.writeFile(path.join(tempDir, ".git", "config"), "match in git")
			await fs.writeFile(path.join(tempDir, "source.txt"), "match in source")

			const results = await collect(search({ cwd: tempDir, pattern: "match" }))

			expect(results).toHaveLength(1)
			expect(results[0]?.path).toBe("source.txt")
		})

		it("returns correct line numbers", async () => {
			await fs.writeFile(
				path.join(tempDir, "file.txt"),
				"line 1\nline 2\ntarget line\nline 4",
			)

			const results = await collect(
				search({ cwd: tempDir, pattern: "target" }),
			)

			expect(results).toHaveLength(1)
			expect(results[0]?.lineNumber).toBe(3)
			expect(results[0]?.lineText).toBe("target line")
		})
	})
})

