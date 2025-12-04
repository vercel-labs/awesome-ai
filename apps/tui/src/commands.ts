import type { Command } from "./types"

export const COMMANDS: Omit<Command, "action">[] = [
	{ name: "/new", description: "Start a new chat" },
	{ name: "/history", description: "Browse chat history" },
	{ name: "/agent", description: "Select an agent to use" },
	{ name: "/help", description: "List all available commands" },
	{ name: "/clear", description: "Clear terminal history" },
	{ name: "/summarize", description: "Summarize the current conversation" },
	{ name: "/export", description: "Export conversation to clipboard" },
	{ name: "/time", description: "Show current timestamp" },
	{ name: "/version", description: "Show agent version info" },
	{ name: "/reset", description: "Reset agent to initial state" },
	{ name: "/model", description: "Change the AI model" },
	{ name: "/temperature", description: "Adjust response temperature" },
	{ name: "/context", description: "Show current context window" },
	{ name: "/tokens", description: "Display token usage stats" },
	{ name: "/save", description: "Save conversation to file" },
	{ name: "/load", description: "Load conversation from file" },
	{ name: "/theme", description: "Change color theme" },
	{ name: "/debug", description: "Toggle debug mode" },
]
