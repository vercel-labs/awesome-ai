import fg from "fast-glob"
import fs from "fs-extra"
import path from "path"
import { loadConfig } from "tsconfig-paths"

export type ProjectInfo = {
	isSrcDir: boolean
	isTsx: boolean
	aliasPrefix: string | null
}

const PROJECT_SHARED_IGNORE = [
	"**/node_modules/**",
	".next",
	"public",
	"dist",
	"build",
]

export async function getProjectInfo(cwd: string): Promise<ProjectInfo | null> {
	const [isSrcDir, isTsx, aliasPrefix] = await Promise.all([
		fs.pathExists(path.resolve(cwd, "src")),
		isTypeScriptProject(cwd),
		getTsConfigAliasPrefix(cwd),
	])

	return {
		isSrcDir,
		isTsx,
		aliasPrefix,
	}
}

export async function isTypeScriptProject(cwd: string) {
	const files = await fg.glob("tsconfig.*", {
		cwd,
		deep: 1,
		ignore: PROJECT_SHARED_IGNORE,
	})

	return files.length > 0
}

export async function getTsConfigAliasPrefix(cwd: string) {
	const tsConfig = await loadConfig(cwd)

	if (tsConfig.resultType === "failed") {
		return null
	}

	const paths = tsConfig.paths || {}
	const pathKeys = Object.keys(paths)

	if (pathKeys.length === 0) {
		return null
	}

	const firstPath = pathKeys[0]!
	if (firstPath.includes("*")) {
		return firstPath.replace("/*", "")
	}

	return firstPath.replace("/", "")
}
