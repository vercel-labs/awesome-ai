import { useAtom } from "@lfades/atom"
import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core"
import { useEffect, useRef, useState } from "react"
import { colors } from "../theme"
import { fetchAvailableModels, isUsingFallbackModels } from "../utils/models"
import { saveWorkspaceSettings } from "../utils/settings"
import {
	availableModelsAtom,
	inputAtom,
	isLoadingModelsAtom,
	selectedModelAtom,
	selectedModelIndexAtom,
	showModelSelectorAtom,
} from "./atoms"
import { Dialog, DialogSpacer, DialogText, DialogTitle } from "./ui/dialog"

export function ModelSelector() {
	const [models] = useAtom(availableModelsAtom)
	const [selectedIndex] = useAtom(selectedModelIndexAtom)
	const [currentModel] = useAtom(selectedModelAtom)
	const [isLoading] = useAtom(isLoadingModelsAtom)
	const [usingFallback, setUsingFallback] = useState(false)
	const scrollRef = useRef<ScrollBoxRenderable>(null)
	const panelWidth = 60
	const panelHeight = Math.min(models.length + (usingFallback ? 8 : 6), 22)

	// Load models when selector opens
	useEffect(() => {
		if (models.length === 0 && !isLoading) {
			isLoadingModelsAtom.set(true)
			fetchAvailableModels()
				.then((m) => {
					availableModelsAtom.set(m)
					setUsingFallback(isUsingFallbackModels())
				})
				.finally(() => isLoadingModelsAtom.set(false))
		}
	}, [models.length, isLoading])

	// Auto-scroll to keep selected item visible
	useEffect(() => {
		if (scrollRef.current && models.length > 0) {
			const visibleItems = panelHeight - 6
			const scrollTop = Math.max(0, selectedIndex - visibleItems + 1)
			scrollRef.current.scrollTo(scrollTop)
		}
	}, [selectedIndex, models.length, panelHeight])

	// Refocus input when model selector closes (scrollbox steals focus)
	useEffect(() => {
		return () => {
			inputAtom.get()?.focus()
		}
	}, [])

	// Find current model index in the list
	const currentModelIndex = models.findIndex((m) => m.id === currentModel)

	if (isLoading) {
		return (
			<Dialog width={panelWidth}>
				<DialogTitle color={colors.pink}>Select Model</DialogTitle>
				<DialogText muted>Loading available models...</DialogText>
			</Dialog>
		)
	}

	if (models.length === 0) {
		return (
			<Dialog width={panelWidth}>
				<DialogTitle color={colors.pink}>Select Model</DialogTitle>
				<DialogText muted>No models found.</DialogText>
				<DialogText muted>
					Make sure you have valid gateway credentials.
				</DialogText>
			</Dialog>
		)
	}

	// Get provider from model id (e.g., "anthropic/claude-sonnet-4" -> "anthropic")
	const getProvider = (id: string) => id.split("/")[0] || "unknown"

	// Group models by provider for display
	let lastProvider = ""

	return (
		<Dialog width={panelWidth} height={panelHeight} maxHeight={22}>
			<DialogTitle
				color={colors.pink}
				hint="↑↓ navigate, Enter select, Esc close"
			>
				Select Model
			</DialogTitle>
			{usingFallback && (
				<>
					<DialogText muted>
						⚠ Using fallback list. Set AI_GATEWAY_API_KEY for full list.
					</DialogText>
					<DialogSpacer />
				</>
			)}
			{currentModel && (
				<>
					<text fg={colors.muted}>
						Current: <span fg={colors.pink}>{currentModel}</span>
					</text>
					<DialogSpacer />
				</>
			)}
			<scrollbox
				ref={scrollRef}
				style={{
					flexGrow: 1,
					contentOptions: {
						backgroundColor: colors.bg,
					},
					scrollbarOptions: {
						showArrows: true,
						trackOptions: {
							foregroundColor: colors.pink,
							backgroundColor: colors.bgLight,
						},
					},
				}}
				focused
			>
				{models.map((model, i) => {
					const provider = getProvider(model.id)
					const showProvider = provider !== lastProvider
					lastProvider = provider

					return (
						<box key={model.id} style={{ flexDirection: "column" }}>
							{showProvider && (
								<text fg={colors.muted} style={{ paddingLeft: 1, height: 1 }}>
									─ {provider.toUpperCase()} ─
								</text>
							)}
							<box
								style={{
									height: 1,
									backgroundColor:
										i === selectedIndex ? colors.bgLight : colors.bg,
									paddingLeft: 1,
									paddingRight: 1,
								}}
							>
								<text>
									<span fg={i === selectedIndex ? colors.text : colors.muted}>
										{i === currentModelIndex ? "● " : "  "}
									</span>
									<span fg={i === selectedIndex ? colors.pink : colors.text}>
										{model.name}
									</span>
								</text>
							</box>
						</box>
					)
				})}
			</scrollbox>
		</Dialog>
	)
}

/**
 * Handle keyboard input for the model selector.
 * Returns true if the key was handled.
 */
export function handleModelSelectorKey(key: KeyEvent): boolean {
	const showSelector = showModelSelectorAtom.get()
	if (!showSelector) return false

	const models = availableModelsAtom.get()
	const selectedIndex = selectedModelIndexAtom.get()

	switch (key.name) {
		case "up":
			selectedModelIndexAtom.set(
				selectedIndex > 0 ? selectedIndex - 1 : models.length - 1,
			)
			return true

		case "down":
			selectedModelIndexAtom.set(
				selectedIndex < models.length - 1 ? selectedIndex + 1 : 0,
			)
			return true

		case "return": {
			const selectedModel = models[selectedIndex]
			if (selectedModel) {
				selectedModelAtom.set(selectedModel.id)
				showModelSelectorAtom.set(false)
				selectedModelIndexAtom.set(0)
				saveWorkspaceSettings({ selectedModel: selectedModel.id })
			}
			return true
		}

		case "escape":
			showModelSelectorAtom.set(false)
			selectedModelIndexAtom.set(0)
			return true

		default:
			return false
	}
}
