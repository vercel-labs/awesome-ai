/**
 * Extracts import information from TypeScript source code.
 * Used by the build-registry script to determine dependencies.
 */

export interface ExtractImportsResult {
	npmDeps: string[]
	npmDevDeps: string[]
	registryDeps: string[]
	toolLibFiles: string[]
	agentLibFiles: string[]
}

export interface ExtractImportsOptions {
	npmPackages: Set<string>
}

/**
 * Packages that don't ship their own types and need @types/* packages.
 * Only add packages here if they require separate type definitions.
 * Most modern packages ship their own types and don't need entries here.
 */
const PACKAGES_NEEDING_TYPES: Record<string, string> = {
	// Add packages that need @types/* here, e.g.:
	// "unzipper": "@types/unzipper",
}

/**
 * Extracts imports from TypeScript source content.
 *
 * @param content - The TypeScript source code to analyze
 * @param options - Configuration for package detection
 * @returns Object containing categorized dependencies
 */
export function extractImports(
	content: string,
	options: ExtractImportsOptions,
): ExtractImportsResult {
	const { npmPackages } = options
	const npmDeps: string[] = []
	const npmDevDeps: string[] = []
	const registryDeps: string[] = []
	const toolLibFiles: string[] = []
	const agentLibFiles: string[] = []

	// Match import statements
	const importRegex =
		/import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["']/g
	let match = importRegex.exec(content)

	while (match !== null) {
		const importPath = match[1]!

		// Skip relative imports (handled separately for lib files)
		if (importPath.startsWith("./") || importPath.startsWith("../")) {
			match = importRegex.exec(content)
			continue
		}

		// Check for @/ alias imports (registry dependencies)
		if (importPath.startsWith("@/tools/lib/")) {
			const libName = importPath.replace("@/tools/lib/", "")
			toolLibFiles.push(libName)
		} else if (importPath.startsWith("@/agents/lib/")) {
			const libName = importPath.replace("@/agents/lib/", "")
			agentLibFiles.push(libName)
		} else if (importPath.startsWith("@/tools/")) {
			const toolName = importPath.replace("@/tools/", "")
			registryDeps.push(`tools:${toolName}`)
		} else if (importPath.startsWith("@/prompts/")) {
			const promptName = importPath.replace("@/prompts/", "")
			registryDeps.push(`prompts:${promptName}`)
		} else if (importPath.startsWith("@/agents/")) {
			const agentName = importPath.replace("@/agents/", "")
			registryDeps.push(`agents:${agentName}`)
		} else if (
			!importPath.startsWith("node:") &&
			!importPath.startsWith("@/")
		) {
			// External npm package
			const packageName = importPath.startsWith("@")
				? importPath.split("/").slice(0, 2).join("/")
				: importPath.split("/")[0]!

			if (npmPackages.has(packageName)) {
				npmDeps.push(packageName)
				// Check if this package needs a separate @types/* package
				const typePackage = PACKAGES_NEEDING_TYPES[packageName]
				if (typePackage) {
					npmDevDeps.push(typePackage)
				}
			}
		}
		match = importRegex.exec(content)
	}

	return {
		npmDeps: [...new Set(npmDeps)],
		npmDevDeps: [...new Set(npmDevDeps)],
		registryDeps: [...new Set(registryDeps)],
		toolLibFiles: [...new Set(toolLibFiles)],
		agentLibFiles: [...new Set(agentLibFiles)],
	}
}
