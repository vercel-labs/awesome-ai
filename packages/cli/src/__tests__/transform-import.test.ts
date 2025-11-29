import { describe, expect, it } from "vitest"
import type { Config } from "../schema"
import { transformImports } from "../utils/transform-import"

// Create a mock config for testing
function createMockConfig(overrides: Partial<Config["aliases"]> = {}): Config {
	return {
		tsx: true,
		aliases: {
			agents: "@/agents",
			tools: "@/tools",
			prompts: "@/prompts",
			...overrides,
		},
		resolvedPaths: {
			cwd: "/test",
			agents: "/test/agents",
			tools: "/test/tools",
			prompts: "/test/prompts",
		},
	}
}

describe("transformImports", () => {
	describe("@/tools/* imports", () => {
		it("transforms @/tools/lib/foo to configured alias", async () => {
			const config = createMockConfig()
			const input = `import { helper } from "@/tools/lib/helper"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "@/tools/lib/helper"`)
		})

		it("transforms @/tools/lib/foo to custom alias", async () => {
			const config = createMockConfig({ tools: "~/my-tools" })
			const input = `import { helper } from "@/tools/lib/helper"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "~/my-tools/lib/helper"`)
		})

		it("transforms bare @/tools import", async () => {
			const config = createMockConfig({ tools: "~/custom-tools" })
			const input = `import * as tools from "@/tools"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "~/custom-tools"`)
		})
	})

	describe("@/prompts/* imports", () => {
		it("transforms @/prompts/test-prompt to configured alias", async () => {
			const config = createMockConfig()
			const input = `import { testPrompt } from "@/prompts/test-prompt"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "@/prompts/test-prompt"`)
		})

		it("transforms @/prompts/test-prompt to custom alias", async () => {
			const config = createMockConfig({ prompts: "src/prompts" })
			const input = `import { testPrompt } from "@/prompts/test-prompt"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "src/prompts/test-prompt"`)
		})
	})

	describe("@/agents/* imports", () => {
		it("transforms @/agents/test-agent to configured alias", async () => {
			const config = createMockConfig()
			const input = `import { testAgent } from "@/agents/test-agent"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "@/agents/test-agent"`)
		})

		it("transforms @/agents/test-agent to custom alias", async () => {
			const config = createMockConfig({ agents: "lib/agents" })
			const input = `import { testAgent } from "@/agents/test-agent"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "lib/agents/test-agent"`)
		})
	})

	describe("unchanged imports", () => {
		it("leaves npm package imports unchanged", async () => {
			const config = createMockConfig()
			const input = `import { z } from "zod"
import { tool } from "ai"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "zod"`)
			expect(result).toContain(`from "ai"`)
		})

		it("leaves relative imports unchanged", async () => {
			const config = createMockConfig()
			const input = `import { helper } from "./helper"
import { util } from "../utils/util"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "./helper"`)
			expect(result).toContain(`from "../utils/util"`)
		})

		it("leaves node: imports unchanged", async () => {
			const config = createMockConfig()
			const input = `import { readFile } from "node:fs/promises"
import path from "node:path"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "node:fs/promises"`)
			expect(result).toContain(`from "node:path"`)
		})
	})

	describe("file type handling", () => {
		it("transforms .ts files", async () => {
			const config = createMockConfig({ tools: "~/tools" })
			const input = `import { x } from "@/tools/x"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "~/tools/x"`)
		})

		it("transforms .tsx files", async () => {
			const config = createMockConfig({ tools: "~/tools" })
			const input = `import { x } from "@/tools/x"`

			const result = await transformImports({
				filename: "component.tsx",
				raw: input,
				config,
			})

			expect(result).toContain(`from "~/tools/x"`)
		})

		it("transforms .js files", async () => {
			const config = createMockConfig({ tools: "~/tools" })
			const input = `import { x } from "@/tools/x"`

			const result = await transformImports({
				filename: "script.js",
				raw: input,
				config,
			})

			expect(result).toContain(`from "~/tools/x"`)
		})

		it("returns raw content for non-JS/TS files", async () => {
			const config = createMockConfig()
			const input = `# Some markdown with @/tools/x reference`

			const result = await transformImports({
				filename: "readme.md",
				raw: input,
				config,
			})

			expect(result).toBe(input)
		})
	})

	describe("complex scenarios", () => {
		it("handles multiple imports in same file", async () => {
			const config = createMockConfig({
				tools: "~/tools",
				prompts: "~/prompts",
				agents: "~/agents",
			})
			const input = `import { tool } from "@/tools/test-tool"
import { prompt } from "@/prompts/test-prompt"
import { agent } from "@/agents/test-agent"
import { z } from "zod"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "~/tools/test-tool"`)
			expect(result).toContain(`from "~/prompts/test-prompt"`)
			expect(result).toContain(`from "~/agents/test-agent"`)
			expect(result).toContain(`from "zod"`)
		})

		it("handles dynamic imports", async () => {
			const config = createMockConfig({ tools: "~/tools" })
			const input = `const tool = await import("@/tools/dynamic-tool")`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`import("~/tools/dynamic-tool")`)
		})

		it("handles re-exports", async () => {
			const config = createMockConfig({ tools: "~/tools" })
			const input = `export { testTool } from "@/tools/test-tool"`

			const result = await transformImports({
				filename: "test.ts",
				raw: input,
				config,
			})

			expect(result).toContain(`from "~/tools/test-tool"`)
		})
	})
})
