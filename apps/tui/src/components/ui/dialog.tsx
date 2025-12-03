import { useTerminalDimensions } from "@opentui/react"
import type { ReactNode } from "react"
import { colors } from "../../theme"

export interface DialogProps {
	/** Fixed width of the dialog */
	width?: number
	/** Fixed height of the dialog (if not provided, uses minHeight) */
	height?: number
	/** Minimum height when height is dynamic */
	minHeight?: number
	/** Maximum height when height is dynamic */
	maxHeight?: number
	/** Dialog content */
	children: ReactNode
}

/**
 * A centered modal dialog component.
 * Provides consistent styling for all modal dialogs in the TUI.
 */
export function Dialog({
	width = 50,
	height,
	minHeight = 8,
	maxHeight = 24,
	children,
}: DialogProps) {
	const { width: termWidth, height: termHeight } = useTerminalDimensions()

	// Clamp height if provided
	const panelHeight = height
		? Math.min(Math.max(height, minHeight), maxHeight)
		: minHeight

	return (
		<box
			style={{
				position: "absolute",
				top: Math.floor(termHeight / 2) - Math.floor(panelHeight / 2),
				left: Math.floor(termWidth / 2) - Math.floor(width / 2),
				width,
				height: panelHeight,
				backgroundColor: colors.bg,
				border: true,
				borderStyle: "single",
				borderColor: colors.border,
				paddingLeft: 1,
				paddingRight: 1,
				flexDirection: "column",
			}}
		>
			{children}
		</box>
	)
}

export interface DialogTitleProps {
	/** Title text */
	children: ReactNode
	/** Accent color for the title (defaults to green) */
	color?: string
	/** Hint text shown next to the title (e.g., "Esc to close") */
	hint?: string
}

/**
 * Dialog title with optional hint text.
 */
export function DialogTitle({
	children,
	color = colors.green,
	hint = "Esc to close",
}: DialogTitleProps) {
	return (
		<>
			<text>
				<span fg={color}>{children}</span>
				{hint && <span fg={colors.muted}> ({hint})</span>}
			</text>
			<DialogSpacer />
		</>
	)
}

/**
 * A spacer component for adding vertical space in dialogs.
 */
export function DialogSpacer() {
	return <box style={{ height: 1 }} />
}

/**
 * A muted text line for dialogs.
 */
export function DialogText({
	children,
	muted = false,
}: {
	children: ReactNode
	muted?: boolean
}) {
	return <text fg={muted ? colors.muted : colors.text}>{children}</text>
}
