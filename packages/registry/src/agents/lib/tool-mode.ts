import type { LanguageModel } from "ai"

export type ToolMode = "patch" | "edit"

interface ModeRule {
	include: string
	exclude?: string[]
}

const RULES: Record<ToolMode, ModeRule[]> = {
	patch: [{ include: "gpt-", exclude: ["oss", "gpt-4"] }],
	edit: [],
}

export function resolveModelId(model: LanguageModel, modelId?: string): string {
	if (modelId) return modelId
	const raw = model as Record<string, unknown>
	const direct = raw["modelId"]
	if (typeof direct === "string") return direct
	const nested = raw["model"]
	if (
		nested &&
		typeof nested === "object" &&
		typeof (nested as Record<string, unknown>)["id"] === "string"
	) {
		return (nested as Record<string, unknown>)["id"] as string
	}
	return ""
}

export function resolveToolMode(
	model: LanguageModel,
	modelId?: string,
	override?: ToolMode,
): ToolMode {
	if (override) return override
	const id = resolveModelId(model, modelId)
	if (!id) return "edit"
	for (const rule of RULES.patch) {
		if (!id.includes(rule.include)) continue
		if (rule.exclude?.some((x) => id.includes(x))) continue
		return "patch"
	}
	return "edit"
}
