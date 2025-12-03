/**
 * Shiki highlighting worker - runs in a separate thread to avoid blocking UI
 */

import { parentPort } from "node:worker_threads"
import {
	type BundledLanguage,
	bundledLanguages,
	createHighlighter,
	type SpecialLanguage,
} from "shiki"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

const defaultTheme = "github-dark"
const jsEngine = createJavaScriptRegexEngine({ forgiving: true })

const highlighterCache = new Map<string, ReturnType<typeof createHighlighter>>()

async function getHighlighter(language: string) {
	const validLanguage = Object.hasOwn(bundledLanguages, language)
		? (language as BundledLanguage)
		: ("text" as SpecialLanguage)

	if (highlighterCache.has(validLanguage)) {
		return {
			highlighter: await highlighterCache.get(validLanguage)!,
			validLanguage,
		}
	}

	const highlighterPromise = createHighlighter({
		themes: [defaultTheme],
		langs: [validLanguage],
		engine: jsEngine,
	})

	highlighterCache.set(validLanguage, highlighterPromise)
	return { highlighter: await highlighterPromise, validLanguage }
}

interface HighlightRequest {
	id: string
	code: string
	language: string
}

interface HighlightResponse {
	id: string
	tokens: Array<Array<{ content: string; color?: string }>>
	bg?: string
	fg?: string
}

parentPort?.on("message", async (request: HighlightRequest) => {
	try {
		const { highlighter, validLanguage } = await getHighlighter(
			request.language,
		)
		const result = highlighter.codeToTokens(request.code, {
			lang: validLanguage,
			theme: defaultTheme,
		})
		const response: HighlightResponse = {
			id: request.id,
			tokens: result.tokens.map((line) =>
				line.map((token) => ({
					content: token.content,
					color: token.color,
				})),
			),
			bg: result.bg,
			fg: result.fg,
		}

		parentPort?.postMessage(response)
	} catch {
		// On error, send back empty result
		parentPort?.postMessage({
			id: request.id,
			tokens: request.code.split("\n").map((line) => [{ content: line }]),
		})
	}
})
