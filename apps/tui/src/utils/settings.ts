import path from "node:path"
import { cwdAtom } from "../components/atoms"
import {
	getStoragePaths,
	getWorkspaceCachePath,
	readJson,
	writeJson,
} from "./storage"

/**
 * Root settings stored in ~/.config/awesome-ai/settings.json
 * These are global defaults that apply to all workspaces
 */
export interface RootSettings {
	defaultModel?: string
	defaultAgent?: string
}

/**
 * Workspace settings stored in ~/.cache/awesome-ai/{workspace-hash}/settings.json
 * These override root settings for a specific workspace
 */
export interface WorkspaceSettings {
	selectedAgent?: string
	selectedModel?: string
	lastChatId?: string
}

/**
 * Combined settings with workspace overriding root
 */
export interface ResolvedSettings {
	model?: string
	agent?: string
	lastChatId?: string
}

function getRootSettingsPath(): string {
	const { config } = getStoragePaths()
	return path.join(config, "settings.json")
}

async function getWorkspaceSettingsPath(): Promise<string> {
	const cwd = cwdAtom.get()
	const workspacePath = await getWorkspaceCachePath(cwd)
	return path.join(workspacePath, "settings.json")
}

/**
 * Load root settings from config directory
 */
export async function loadRootSettings(): Promise<RootSettings> {
	const settingsPath = getRootSettingsPath()
	return (await readJson<RootSettings>(settingsPath)) || {}
}

/**
 * Load workspace-specific settings
 */
export async function loadWorkspaceSettings(): Promise<WorkspaceSettings> {
	const settingsPath = await getWorkspaceSettingsPath()
	return (await readJson<WorkspaceSettings>(settingsPath)) || {}
}

/**
 * Load and resolve settings (workspace overrides root)
 */
export async function loadSettings(): Promise<ResolvedSettings> {
	const [rootSettings, workspaceSettings] = await Promise.all([
		loadRootSettings(),
		loadWorkspaceSettings(),
	])

	return {
		model: workspaceSettings.selectedModel || rootSettings.defaultModel,
		agent: workspaceSettings.selectedAgent || rootSettings.defaultAgent,
		lastChatId: workspaceSettings.lastChatId,
	}
}

export async function saveWorkspaceSettings(
	settings: Partial<WorkspaceSettings>,
) {
	const settingsPath = await getWorkspaceSettingsPath()
	const existing = await loadWorkspaceSettings()

	await writeJson<WorkspaceSettings>(settingsPath, {
		...existing,
		...settings,
	})
}
