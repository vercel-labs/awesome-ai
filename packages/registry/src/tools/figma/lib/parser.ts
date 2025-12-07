import type {
	ComponentData,
	ExtractedData,
	ExtractionConfig,
	FigmaFile,
	FigmaNode,
	FrameInfo,
	PageInfo,
	SectionInfo,
} from "./types"

const defaultConfig: Required<ExtractionConfig> = {
	skipInvisible: true,
}

interface TraversalContext {
	pageId: string
	frameId: string
}

function isFrameType(type: string): boolean {
	return type === "FRAME" || type === "COMPONENT" || type === "COMPONENT_SET"
}

export function extractFigmaStructure(
	fileData: FigmaFile,
	config: ExtractionConfig = {},
): ExtractedData {
	const { skipInvisible } = { ...defaultConfig, ...config }

	const shouldSkipNode = (node: FigmaNode): boolean => {
		if (skipInvisible && node.visible === false) {
			return true
		}
		return false
	}

	const filterInvisibleNodes = (node: FigmaNode): FigmaNode => {
		if (!skipInvisible) return node

		const filtered = { ...node }
		if (filtered.children) {
			filtered.children = filtered.children
				.filter((child) => child.visible !== false)
				.map((child) => filterInvisibleNodes(child))
		}
		return filtered
	}

	const componentUsage = new Map<
		string,
		{
			usedInFrames: Set<string>
			instanceCount: number
		}
	>()

	const pages: PageInfo[] = []
	const allSections = new Map<string, SectionInfo>()
	const allFrames = new Map<string, FrameInfo>()
	const componentDefinitions = new Map<string, FigmaNode>()
	const frameComponents = new Map<string, Set<string>>()

	const getComponentName = (id: string): string => {
		return fileData.components[id]?.name || "Unknown Component"
	}

	const getComponentDescription = (id: string): string | undefined => {
		return fileData.components[id]?.description
	}

	const cloneNode = (node: FigmaNode): FigmaNode => {
		return JSON.parse(JSON.stringify(node))
	}

	function collectSections(
		node: FigmaNode,
		parentSectionId?: string,
	): string[] {
		const sectionIds: string[] = []

		if (!node.children) return sectionIds

		for (const child of node.children) {
			if (shouldSkipNode(child)) continue

			if (child.type === "SECTION") {
				const sectionInfo: SectionInfo = {
					id: child.id,
					name: child.name,
					parentSectionId,
					frameIds: [],
				}

				if (child.children) {
					for (const grandChild of child.children) {
						if (!shouldSkipNode(grandChild) && isFrameType(grandChild.type)) {
							sectionInfo.frameIds.push(grandChild.id)
						}
					}
				}

				allSections.set(child.id, sectionInfo)
				sectionIds.push(child.id)

				const nestedSectionIds = collectSections(child, child.id)
				sectionIds.push(...nestedSectionIds)
			}
		}

		return sectionIds
	}

	function traverseFrame(node: FigmaNode, context: TraversalContext) {
		if (shouldSkipNode(node)) return

		if (node.type === "COMPONENT") {
			componentDefinitions.set(node.id, filterInvisibleNodes(cloneNode(node)))
		}

		if (node.type === "COMPONENT_SET") {
			componentDefinitions.set(node.id, filterInvisibleNodes(cloneNode(node)))
			if (node.children) {
				for (const variant of node.children) {
					if (variant.type === "COMPONENT" && !shouldSkipNode(variant)) {
						componentDefinitions.set(
							variant.id,
							filterInvisibleNodes(cloneNode(variant)),
						)
					}
				}
			}
		}

		if (node.type === "INSTANCE" && node.componentId) {
			const compId = node.componentId

			frameComponents.get(context.frameId)?.add(compId)

			const existing = componentUsage.get(compId)
			if (existing) {
				existing.instanceCount++
				existing.usedInFrames.add(context.frameId)
			} else {
				componentUsage.set(compId, {
					instanceCount: 1,
					usedInFrames: new Set([context.frameId]),
				})
			}
		}

		if (node.children) {
			for (const child of node.children) {
				traverseFrame(child, context)
			}
		}
	}

	function collectFrames(
		node: FigmaNode,
		pageId: string,
		sectionId?: string,
	): FrameInfo[] {
		const frames: FrameInfo[] = []

		if (!node.children) return frames

		for (const child of node.children) {
			if (shouldSkipNode(child)) continue

			if (child.type === "SECTION") {
				const sectionFrames = collectFrames(child, pageId, child.id)
				frames.push(...sectionFrames)
			} else if (isFrameType(child.type)) {
				frameComponents.set(child.id, new Set())

				traverseFrame(child, {
					pageId,
					frameId: child.id,
				})

				const frameInfo: FrameInfo = {
					id: child.id,
					name: child.name,
					type: child.type,
					pageId,
					sectionId,
					componentsUsed: Array.from(frameComponents.get(child.id) || []),
					definition: filterInvisibleNodes(cloneNode(child)),
				}

				frames.push(frameInfo)
				allFrames.set(child.id, frameInfo)
			}
		}

		return frames
	}

	if (fileData.document.children) {
		for (const pageNode of fileData.document.children) {
			if (pageNode.type === "CANVAS") {
				const pageId = pageNode.id
				const pageName = pageNode.name

				const sectionIds = collectSections(pageNode)
				const frames = collectFrames(pageNode, pageId)

				pages.push({
					id: pageId,
					name: pageName,
					sectionIds,
					frameIds: frames.map((f) => f.id),
				})
			}
		}
	}

	const components: Record<string, ComponentData> = {}

	for (const [compId, usage] of componentUsage.entries()) {
		components[compId] = {
			name: getComponentName(compId),
			description: getComponentDescription(compId),
			definition: componentDefinitions.get(compId) || null,
			usedInFrames: Array.from(usage.usedInFrames),
			instanceCount: usage.instanceCount,
		}
	}

	return {
		pages,
		sections: Object.fromEntries(allSections),
		frames: Object.fromEntries(allFrames),
		components,
	}
}

export function getComponent(
	data: ExtractedData,
	nameOrId: string,
): ComponentData | null {
	if (data.components[nameOrId]) {
		return data.components[nameOrId]
	}

	const lowerName = nameOrId.toLowerCase()
	for (const comp of Object.values(data.components)) {
		if (comp.name.toLowerCase() === lowerName) {
			return comp
		}
	}

	return null
}

export function listComponents(
	data: ExtractedData,
): { id: string; name: string; instanceCount: number }[] {
	return Object.entries(data.components)
		.map(([id, comp]) => ({
			id,
			name: comp.name,
			instanceCount: comp.instanceCount,
		}))
		.sort((a, b) => b.instanceCount - a.instanceCount)
}

export function listFrames(data: ExtractedData): FrameInfo[] {
	return Object.values(data.frames)
}

export function getFrame(
	data: ExtractedData,
	nameOrId: string,
): FrameInfo | null {
	if (data.frames[nameOrId]) {
		return data.frames[nameOrId]
	}

	const lowerName = nameOrId.toLowerCase()
	for (const frame of Object.values(data.frames)) {
		if (frame.name.toLowerCase() === lowerName) {
			return frame
		}
	}

	return null
}
