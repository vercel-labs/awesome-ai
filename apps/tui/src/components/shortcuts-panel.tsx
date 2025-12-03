import { colors } from "../theme"
import { Dialog, DialogSpacer, DialogTitle } from "./ui/dialog"

const SHORTCUTS = {
	navigation: [
		{ action: "Select agent", keys: ["⌥ A"] },
		{ action: "Select model", keys: ["⌥ M"] },
		{ action: "Toggle shortcuts panel", keys: ["⌥ S"] },
		{ action: "Toggle debug overlay", keys: ["⌥ D"] },
		{ action: "Copy selected text", keys: ["⌥ C"] },
		{ action: "Approve pending tool", keys: ["⌥ Y"] },
		{ action: "Deny pending tool", keys: ["⌥ N"] },
		{ action: "Stop generation", keys: ["⌥ X"] },
		{ action: "Scroll to bottom", keys: ["⌥ B"] },
		{ action: "Previous command in history", keys: ["↑"] },
		{ action: "Next command in history", keys: ["↓"] },
		{ action: "Autocomplete command", keys: ["Tab"] },
		{ action: "Send message / execute command", keys: ["Enter"] },
		{ action: "Close panel / clear suggestions", keys: ["Esc"] },
		{ action: "Start command input", keys: ["/"] },
	],
	commands: [
		{ action: "List all available commands", keys: ["/help"] },
		{ action: "Select AI model", keys: ["/model"] },
		{ action: "Clear terminal history", keys: ["/clear"] },
		{ action: "Summarize conversation", keys: ["/summarize"] },
		{ action: "Export to clipboard", keys: ["/export"] },
		{ action: "Show current timestamp", keys: ["/time"] },
		{ action: "Show version info", keys: ["/version"] },
	],
}

function ShortcutRow({ action, keys }: { action: string; keys: string[] }) {
	return (
		<box
			style={{
				height: 1,
				flexDirection: "row",
				justifyContent: "space-between",
				paddingRight: 1,
			}}
		>
			<text fg={colors.text}>{action}</text>
			<box style={{ flexDirection: "row" }}>
				{keys.map((key, i) => (
					<text key={i}>
						{i > 0 && <span fg={colors.muted}> </span>}
						<span fg={colors.green}>{key}</span>
					</text>
				))}
			</box>
		</box>
	)
}

export function ShortcutsPanel() {
	const panelHeight =
		SHORTCUTS.navigation.length + SHORTCUTS.commands.length + 8

	return (
		<Dialog height={panelHeight} maxHeight={30}>
			<DialogTitle hint="⌥ S or Esc to close">Shortcuts</DialogTitle>
			<text fg={colors.muted}>NAVIGATION</text>
			<DialogSpacer />
			{SHORTCUTS.navigation.map((shortcut) => (
				<ShortcutRow
					key={shortcut.action}
					action={shortcut.action}
					keys={shortcut.keys}
				/>
			))}
			<DialogSpacer />
			<text fg={colors.muted}>COMMANDS</text>
			<DialogSpacer />
			{SHORTCUTS.commands.map((shortcut) => (
				<ShortcutRow
					key={shortcut.action}
					action={shortcut.action}
					keys={shortcut.keys}
				/>
			))}
		</Dialog>
	)
}
