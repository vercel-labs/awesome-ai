import { describe, expect, it } from "vitest"
import { trimDiff } from "../../lib/trim-diff"

describe("trimDiff", () => {
	it("removes common indentation from diff content lines", () => {
		const diff = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
     line1
-    old line
+    new line
     line3`
		const result = trimDiff(diff)
		expect(result).toContain("-old line")
		expect(result).toContain("+new line")
	})

	it("preserves diff when no common indentation", () => {
		const diff = `--- a/file
+++ b/file
@@ -1 +1 @@
-old
+new`
		const result = trimDiff(diff)
		expect(result).toContain("-old")
		expect(result).toContain("+new")
	})

	it("handles empty content lines", () => {
		const diff = `--- a/file
+++ b/file
@@ -1,2 +1,2 @@
-old
+new`
		const result = trimDiff(diff)
		expect(result).toBe(diff)
	})
})

