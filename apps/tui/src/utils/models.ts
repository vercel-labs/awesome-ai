import { debugLog } from "../components/atoms"

export interface AvailableModel {
	id: string
	name: string
	description?: string | null
	provider: string
	pricing?: {
		input: string
		output: string
		cachedInputTokens?: string
		cacheCreationInputTokens?: string
	} | null
}

interface GatewayModelResponse {
	models: Array<{
		id: string
		name: string
		description?: string | null
		pricing?: {
			input: string
			output: string
			input_cache_read?: string | null
			input_cache_write?: string | null
		} | null
		specification: {
			specificationVersion: string
			provider: string
			modelId: string
		}
		modelType?: "language" | "embedding" | "image" | null
	}>
}

/**
 * Fallback list of popular models when gateway is unavailable.
 * These are commonly used models that work with the AI Gateway.
 */
const FALLBACK_MODELS: AvailableModel[] = [
	// Anthropic
	{
		id: "anthropic/claude-sonnet-4-20250514",
		name: "Claude Sonnet 4",
		provider: "anthropic",
	},
	{
		id: "anthropic/claude-opus-4.5",
		name: "Claude Opus 4.5",
		provider: "anthropic",
	},
	{
		id: "anthropic/claude-3-5-haiku-20241022",
		name: "Claude 3.5 Haiku",
		provider: "anthropic",
	},
	// OpenAI
	{ id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" },
	{ id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
	{ id: "openai/o1", name: "o1", provider: "openai" },
	{ id: "openai/o1-mini", name: "o1 Mini", provider: "openai" },
	{ id: "openai/o3-mini", name: "o3 Mini", provider: "openai" },
	// Google
	{
		id: "google/gemini-2.0-flash",
		name: "Gemini 2.0 Flash",
		provider: "google",
	},
	{
		id: "google/gemini-2.5-pro-preview-05-06",
		name: "Gemini 2.5 Pro",
		provider: "google",
	},
	// xAI
	{ id: "xai/grok-3", name: "Grok 3", provider: "xai" },
	{ id: "xai/grok-3-mini", name: "Grok 3 Mini", provider: "xai" },
	// DeepSeek
	{ id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
	{
		id: "deepseek/deepseek-reasoner",
		name: "DeepSeek Reasoner",
		provider: "deepseek",
	},
]

let cachedModels: AvailableModel[] | null = null
let fetchPromise: Promise<AvailableModel[]> | null = null
let usedFallback = false

/**
 * Check if the last fetch used fallback models.
 */
export function isUsingFallbackModels(): boolean {
	return usedFallback
}

/**
 * Fetch available models from the AI Gateway.
 * Results are cached to avoid repeated API calls.
 * Falls back to a curated list if gateway is unavailable.
 */
export async function fetchAvailableModels(): Promise<AvailableModel[]> {
	if (cachedModels) return cachedModels

	// Dedupe concurrent requests
	if (fetchPromise) return fetchPromise

	fetchPromise = (async () => {
		// Log API key presence for debugging
		const apiKey = process.env.AI_GATEWAY_API_KEY

		try {
			// Direct fetch to bypass SDK parsing issues
			const response = await fetch(
				"https://ai-gateway.vercel.sh/v1/ai/config",
				{
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
						"ai-gateway-protocol-version": "0.0.1",
					},
				},
			)

			if (!response.ok) {
				const errorText = await response.text()
				debugLog("Gateway error response:", errorText.slice(0, 200))
				throw new Error(`Gateway returned ${response.status}: ${errorText}`)
			}

			const data = (await response.json()) as GatewayModelResponse
			debugLog("Gateway returned", data.models?.length ?? 0, "models")

			const models: AvailableModel[] = data.models
				.filter((m) => m.modelType === "language" || m.modelType === null)
				.map((m) => ({
					id: m.id,
					name: m.name,
					description: m.description,
					provider: m.specification.provider,
					pricing: m.pricing
						? {
								input: m.pricing.input,
								output: m.pricing.output,
								cachedInputTokens: m.pricing.input_cache_read ?? undefined,
								cacheCreationInputTokens:
									m.pricing.input_cache_write ?? undefined,
							}
						: null,
				}))
				.sort((a, b) => {
					// Sort by provider first, then by name
					const providerCompare = a.provider.localeCompare(b.provider)
					if (providerCompare !== 0) return providerCompare
					return a.name.localeCompare(b.name)
				})

			cachedModels = models
			usedFallback = false
			return models
		} catch (error) {
			// Log detailed error for debugging
			debugLog("Failed to fetch models from gateway:")
			debugLog("  Error type:", error?.constructor?.name)
			debugLog(
				"  Message:",
				error instanceof Error ? error.message : String(error),
			)

			// Return fallback models
			cachedModels = FALLBACK_MODELS
			usedFallback = true
			return FALLBACK_MODELS
		} finally {
			fetchPromise = null
		}
	})()

	return fetchPromise
}
