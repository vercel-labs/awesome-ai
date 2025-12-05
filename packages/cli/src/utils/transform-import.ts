import { promises as fs } from "fs"
import { tmpdir } from "os"
import path from "path"
import { Project, ScriptKind } from "ts-morph"
import type { Config } from "../schema"

const project = new Project({
	compilerOptions: {},
})

async function createTempSourceFile(filename: string) {
	const dir = await fs.mkdtemp(path.join(tmpdir(), "awesome-ai-"))
	// Always use .ts extension for temp files to ensure proper parsing
	const baseName = path.basename(filename, path.extname(filename))
	return path.join(dir, `${baseName}.ts`)
}

export type TransformOpts = {
	filename: string
	raw: string
	config: Config
	isRemote?: boolean
}

function getScriptKind(filename: string): ScriptKind {
	const ext = path.extname(filename).toLowerCase()
	switch (ext) {
		case ".tsx":
		case ".jsx":
			return ScriptKind.TSX
		case ".ts":
		case ".js":
			// Use TS for JS files so import parsing works correctly
			return ScriptKind.TS
		default:
			return ScriptKind.Unknown
	}
}

export async function transformImports(opts: TransformOpts): Promise<string> {
	const ext = path.extname(opts.filename).toLowerCase()
	if (![".tsx", ".ts", ".jsx", ".js"].includes(ext)) {
		return opts.raw
	}

	const scriptKind = getScriptKind(opts.filename)
	const tempFile = await createTempSourceFile(opts.filename)
	const sourceFile = project.createSourceFile(tempFile, opts.raw, {
		scriptKind,
	})

	for (const specifier of sourceFile.getImportStringLiterals()) {
		const updated = updateImportAliases(
			specifier.getLiteralValue(),
			opts.config,
			opts.isRemote,
		)
		specifier.setLiteralValue(updated)
	}

	return sourceFile.getText()
}

function updateImportAliases(
	moduleSpecifier: string,
	config: Config,
	_isRemote: boolean = false,
) {
	if (moduleSpecifier.startsWith("@/tools/")) {
		const rest = moduleSpecifier.replace(/^@\/tools\//, "")
		return `${config.aliases.tools}/${rest}`
	}
	if (moduleSpecifier === "@/tools") {
		return config.aliases.tools
	}

	if (moduleSpecifier.startsWith("@/prompts/")) {
		const rest = moduleSpecifier.replace(/^@\/prompts\//, "")
		return `${config.aliases.prompts}/${rest}`
	}
	if (moduleSpecifier === "@/prompts") {
		return config.aliases.prompts
	}

	if (moduleSpecifier.startsWith("@/agents/")) {
		const rest = moduleSpecifier.replace(/^@\/agents\//, "")
		return `${config.aliases.agents}/${rest}`
	}
	if (moduleSpecifier === "@/agents") {
		return config.aliases.agents
	}

	return moduleSpecifier
}
