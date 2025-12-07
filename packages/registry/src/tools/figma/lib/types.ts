// ============================================================================
// Figma Node Types & Interfaces
// Based on https://developers.figma.com/docs/rest-api/file-node-types/
// ============================================================================

export interface Color {
	r: number
	g: number
	b: number
	a: number
}

export interface Paint {
	type:
		| "SOLID"
		| "GRADIENT_LINEAR"
		| "GRADIENT_RADIAL"
		| "GRADIENT_ANGULAR"
		| "GRADIENT_DIAMOND"
		| "IMAGE"
		| "EMOJI"
		| "VIDEO"
	visible?: boolean
	opacity?: number
	color?: Color
	blendMode?: string
	gradientHandlePositions?: { x: number; y: number }[]
	gradientStops?: { position: number; color: Color }[]
	scaleMode?: string
	imageRef?: string
}

export interface Effect {
	type: "INNER_SHADOW" | "DROP_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR"
	visible?: boolean
	radius: number
	color?: Color
	blendMode?: string
	offset?: { x: number; y: number }
	spread?: number
}

export interface Constraint {
	type: "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE"
	value: number
}

export interface Rectangle {
	x: number
	y: number
	width: number
	height: number
}

export interface TypeStyle {
	fontFamily?: string
	fontPostScriptName?: string
	fontWeight?: number
	fontSize?: number
	textAlignHorizontal?: "LEFT" | "RIGHT" | "CENTER" | "JUSTIFIED"
	textAlignVertical?: "TOP" | "CENTER" | "BOTTOM"
	letterSpacing?: number
	lineHeightPx?: number
	lineHeightPercent?: number
	lineHeightUnit?: string
	textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE"
	textDecoration?: "NONE" | "STRIKETHROUGH" | "UNDERLINE"
	fills?: Paint[]
}

export interface StrokeWeights {
	top: number
	right: number
	bottom: number
	left: number
}

export interface FigmaNode {
	id: string
	name: string
	type: string
	visible?: boolean
	children?: FigmaNode[]

	// Instance-specific
	componentId?: string

	// Component-specific
	componentPropertyDefinitions?: Record<string, unknown>

	// Geometry
	absoluteBoundingBox?: Rectangle
	absoluteRenderBounds?: Rectangle
	size?: { x: number; y: number }
	relativeTransform?: number[][]

	// Constraints & Layout
	constraints?: { horizontal: string; vertical: string }
	layoutAlign?: string
	layoutGrow?: number
	layoutPositioning?: string

	// Auto Layout (Flexbox)
	layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL"
	primaryAxisSizingMode?: "FIXED" | "AUTO"
	counterAxisSizingMode?: "FIXED" | "AUTO"
	primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN"
	counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE"
	paddingLeft?: number
	paddingRight?: number
	paddingTop?: number
	paddingBottom?: number
	itemSpacing?: number
	counterAxisSpacing?: number
	layoutWrap?: "NO_WRAP" | "WRAP"

	// Appearance
	fills?: Paint[]
	strokes?: Paint[]
	strokeWeight?: number
	strokeAlign?: "INSIDE" | "OUTSIDE" | "CENTER"
	strokeCap?: string
	strokeJoin?: string
	strokeDashes?: number[]
	individualStrokeWeights?: StrokeWeights
	cornerRadius?: number
	rectangleCornerRadii?: number[]
	effects?: Effect[]
	blendMode?: string
	opacity?: number
	isMask?: boolean

	// Clipping
	clipsContent?: boolean

	// Text-specific
	characters?: string
	style?: TypeStyle
	characterStyleOverrides?: number[]
	styleOverrideTable?: Record<string, TypeStyle>
	textAutoResize?: string

	// Vector-specific
	fillGeometry?: unknown[]
	strokeGeometry?: unknown[]

	// Export settings
	exportSettings?: unknown[]

	// Interactions/Prototyping
	transitionNodeID?: string
	transitionDuration?: number
	transitionEasing?: string
}

export interface FigmaFile {
	document: FigmaNode
	components: Record<
		string,
		{ name: string; description?: string; key?: string }
	>
	styles?: Record<
		string,
		{ name: string; styleType: string; description?: string }
	>
}

// ============================================================================
// Extracted Data Types
// ============================================================================

export interface FrameInfo {
	id: string
	name: string
	type: string
	pageId: string
	sectionId?: string
	componentsUsed: string[]
	definition: FigmaNode | null
}

export interface SectionInfo {
	id: string
	name: string
	parentSectionId?: string
	frameIds: string[]
}

export interface PageInfo {
	id: string
	name: string
	sectionIds: string[]
	frameIds: string[]
}

export interface ComponentData {
	name: string
	description?: string
	definition: FigmaNode | null
	usedInFrames: string[]
	instanceCount: number
}

export interface ExtractedData {
	pages: PageInfo[]
	sections: Record<string, SectionInfo>
	frames: Record<string, FrameInfo>
	components: Record<string, ComponentData>
}

export interface ExtractionConfig {
	skipInvisible?: boolean
}

// ============================================================================
// Migration State Types
// ============================================================================

export type MigrationPhase = "components" | "pages" | "done"

export type ComponentStatus = "pending" | "in_progress" | "done" | "skipped"

export type PageStatus = "blocked" | "pending" | "in_progress" | "done"

export interface ComponentState {
	figmaId: string
	name: string
	status: ComponentStatus
	dependencies: string[]
	dependenciesReady: boolean
	instanceCount: number
	outputPath?: string
	completedAt?: string
	skipReason?: string
}

export interface PageState {
	figmaId: string
	frameName: string
	status: PageStatus
	componentsUsed: string[]
	componentsReady: boolean
	outputPath?: string
	completedAt?: string
}

export interface MigrationStats {
	totalComponents: number
	completedComponents: number
	skippedComponents: number
	totalPages: number
	completedPages: number
	phase: MigrationPhase
}

export interface MigrationState {
	figmaFileKey: string
	figmaFileUrl: string
	createdAt: string
	updatedAt: string
	stats: MigrationStats
	components: Record<string, ComponentState>
	pages: Record<string, PageState>
	/** Post-processed Figma data for component/page definitions */
	figmaData: ExtractedData
}

// ============================================================================
// Tool Input/Output Types
// ============================================================================

export interface MigrationNextItem {
	type: "component" | "page"
	id: string
	name: string
	instanceCount?: number
	dependencies?: string[]
	componentsUsed?: string[]
}

export interface MigrationProgressResult {
	phase: MigrationPhase
	components: {
		total: number
		done: number
		inProgress: number
		pending: number
		skipped: number
	}
	pages: {
		total: number
		done: number
		ready: number
		blocked: number
	}
	currentTask?: string
	nextUp: string[]
}
