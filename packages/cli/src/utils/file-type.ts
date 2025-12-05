import type { RegistryItemCategory } from "../registry/schema"

/**
 * Get the target directory for a registry file based on its type.
 */
export function getTargetDir(
	file: { type: string; path: string },
	fallback: RegistryItemCategory,
): RegistryItemCategory {
	if (file.type === "registry:agent") return "agents"
	if (file.type === "registry:tool") return "tools"
	if (file.type === "registry:prompt") return "prompts"
	if (file.type === "registry:lib") {
		if (file.path.startsWith("tools/")) return "tools"
		if (file.path.startsWith("agents/")) return "agents"
		if (file.path.startsWith("prompts/")) return "prompts"
	}
	return fallback
}

/**
 * Get the relative path by stripping the type prefix from a file path.
 */
export function getRelativePath(filePath: string) {
	return filePath.replace(/^(agents|tools|prompts)\//, "")
}
