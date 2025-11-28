import { existsSync, readFileSync } from "fs"
import path from "path"

export function getPackageInfo(cwd: string, includeDevDeps = true) {
	const packageJsonPath = path.resolve(cwd, "package.json")

	if (!existsSync(packageJsonPath)) {
		return null
	}

	try {
		const content = readFileSync(packageJsonPath, "utf-8")
		const packageJson = JSON.parse(content)

		return {
			dependencies: packageJson.dependencies || {},
			devDependencies: includeDevDeps ? packageJson.devDependencies || {} : {},
		}
	} catch {
		return null
	}
}
