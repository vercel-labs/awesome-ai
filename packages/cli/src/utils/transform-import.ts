import { promises as fs } from "fs"
import { tmpdir } from "os"
import path from "path"
import { Project, ScriptKind } from "ts-morph"
import type { Config } from "@/src/schema"

const project = new Project({
	compilerOptions: {},
})

async function createTempSourceFile(filename: string) {
	const dir = await fs.mkdtemp(path.join(tmpdir(), "awesome-ai-"))
	return path.join(dir, filename)
}

export type TransformOpts = {
	filename: string
	raw: string
	config: Config
	isRemote?: boolean
}

export async function transformImports(opts: TransformOpts): Promise<string> {
	const tempFile = await createTempSourceFile(opts.filename)
	const sourceFile = project.createSourceFile(tempFile, opts.raw, {
		scriptKind: ScriptKind.TSX,
	})

	if (![".tsx", ".ts", ".jsx", ".js"].includes(sourceFile.getExtension())) {
		return opts.raw
	}

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
	// Not a local import - keep as is
	if (
		!moduleSpecifier.startsWith("@tools") &&
		!moduleSpecifier.startsWith("@prompts") &&
		!moduleSpecifier.startsWith("@agents") &&
		!moduleSpecifier.startsWith("@/")
	) {
		return moduleSpecifier
	}

	// Handle @tools, @prompts, @agents imports
	if (moduleSpecifier.startsWith("@tools")) {
		const rest = moduleSpecifier.replace(/^@tools/, "")
		const alias = config.aliases.tools.split("/")[0]
		return `${alias}${rest}`
	}

	if (moduleSpecifier.startsWith("@prompts")) {
		const rest = moduleSpecifier.replace(/^@prompts/, "")
		const alias = config.aliases.prompts.split("/")[0]
		return `${alias}${rest}`
	}

	if (moduleSpecifier.startsWith("@agents")) {
		const rest = moduleSpecifier.replace(/^@agents/, "")
		const alias = config.aliases.agents.split("/")[0]
		return `${alias}${rest}`
	}

	// Handle @/ imports (fallback to default alias)
	if (moduleSpecifier.startsWith("@/")) {
		const alias = config.aliases.agents.split("/")[0]
		return moduleSpecifier.replace(/^@\//, `${alias}/`)
	}

	return moduleSpecifier
}
