import { describe, expect, it } from "vitest"
import { extractImports } from "../extract-imports"

describe("extractImports", () => {
	const defaultOptions = {
		npmPackages: new Set(["zod", "ai", "unzipper", "diff"]),
	}

	it("extracts npm dependencies from imports", () => {
		const content = `
import { z } from "zod"
import { tool } from "ai"
`
		const result = extractImports(content, defaultOptions)

		expect(result.npmDeps).toEqual(["zod", "ai"])
		expect(result.npmDevDeps).toEqual([])
	})

	it("does not include @types/* for packages not in PACKAGES_NEEDING_TYPES", () => {
		const content = `
import unzipper from "unzipper"
import { diffLines } from "diff"
`
		const result = extractImports(content, defaultOptions)

		expect(result.npmDeps).toEqual(["unzipper", "diff"])
		// Currently no packages in PACKAGES_NEEDING_TYPES, so no devDeps
		expect(result.npmDevDeps).toEqual([])
	})

	it("extracts registry dependencies from @/tools/* imports", () => {
		const content = `
import { bash } from "@/tools/bash"
import { read } from "@/tools/read"
`
		const result = extractImports(content, defaultOptions)

		expect(result.registryDeps).toEqual(["tools:bash", "tools:read"])
	})

	it("extracts registry dependencies from @/prompts/* imports", () => {
		const content = `
import { CODING_PROMPT } from "@/prompts/coding-agent"
`
		const result = extractImports(content, defaultOptions)

		expect(result.registryDeps).toEqual(["prompts:coding-agent"])
	})

	it("extracts registry dependencies from @/agents/* imports", () => {
		const content = `
import { planningAgent } from "@/agents/planning-agent"
`
		const result = extractImports(content, defaultOptions)

		expect(result.registryDeps).toEqual(["agents:planning-agent"])
	})

	it("extracts tool lib files from @/tools/lib/* imports", () => {
		const content = `
import { getRipgrepPath } from "@/tools/lib/ripgrep"
`
		const result = extractImports(content, defaultOptions)

		expect(result.toolLibFiles).toEqual(["ripgrep"])
	})

	it("extracts agent lib files from @/agents/lib/* imports", () => {
		const content = `
import { createContext } from "@/agents/lib/context"
`
		const result = extractImports(content, defaultOptions)

		expect(result.agentLibFiles).toEqual(["context"])
	})

	it("ignores relative imports", () => {
		const content = `
import { helper } from "./helper"
import { util } from "../utils"
`
		const result = extractImports(content, defaultOptions)

		expect(result.npmDeps).toEqual([])
		expect(result.registryDeps).toEqual([])
	})

	it("ignores node: imports", () => {
		const content = `
import { promises as fs } from "node:fs"
import path from "node:path"
`
		const result = extractImports(content, defaultOptions)

		expect(result.npmDeps).toEqual([])
	})

	it("handles scoped npm packages correctly", () => {
		const options = {
			npmPackages: new Set(["@ai-sdk/openai", "@radix-ui/react-dialog"]),
		}

		const content = `
import { openai } from "@ai-sdk/openai"
import { Dialog } from "@radix-ui/react-dialog"
`
		const result = extractImports(content, options)

		expect(result.npmDeps).toEqual(["@ai-sdk/openai", "@radix-ui/react-dialog"])
	})

	it("deduplicates dependencies", () => {
		const content = `
import { z } from "zod"
import { ZodError } from "zod"
import unzipper from "unzipper"
import { Open } from "unzipper"
`
		const result = extractImports(content, defaultOptions)

		expect(result.npmDeps).toEqual(["zod", "unzipper"])
	})

	it("handles mixed imports correctly", () => {
		const content = `
import { z } from "zod"
import unzipper from "unzipper"
import { getRipgrepPath } from "@/tools/lib/ripgrep"
import { bash } from "@/tools/bash"
import { promises as fs } from "node:fs"
import { helper } from "./helper"
`
		const result = extractImports(content, defaultOptions)

		expect(result.npmDeps).toEqual(["zod", "unzipper"])
		expect(result.toolLibFiles).toEqual(["ripgrep"])
		expect(result.registryDeps).toEqual(["tools:bash"])
	})
})
