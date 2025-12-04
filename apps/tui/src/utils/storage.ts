import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { $ } from "bun"
import { cwdAtom } from "../components/atoms"
import type { TUIMessage } from "../types"

const APP_NAME = "awesome-ai"

export interface StoredChat {
	id: string
	title: string
	messages: TUIMessage[]
	createdAt: number
	updatedAt: number
}

/**
 * Get XDG-based storage paths for the application
 */
export function getStoragePaths() {
	const home = os.homedir()
	const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config")
	const xdgCache = process.env.XDG_CACHE_HOME || path.join(home, ".cache")

	return {
		config: path.join(xdgConfig, APP_NAME),
		cache: path.join(xdgCache, APP_NAME),
	}
}

/**
 * Find .git directory by walking up from start directory
 */
async function findGitDir(start: string): Promise<string | null> {
	let current = start
	while (true) {
		const gitPath = path.join(current, ".git")
		try {
			await fs.access(gitPath)
			return gitPath
		} catch {
			// Not found, continue up
		}
		const parent = path.dirname(current)
		if (parent === current) break
		current = parent
	}
	return null
}

/**
 * Get the root commit hash from a git repository
 */
async function getGitRootCommit(cwd: string) {
	try {
		const result = await $`git rev-list --max-parents=0 HEAD`
			.quiet()
			.nothrow()
			.cwd(cwd)
			.text()
		return result.trim().split("\n")[0]
	} catch {}
}

/**
 * Generate a short hash from a string (for folder names)
 */
function hashString(input: string): string {
	return createHash("sha256").update(input).digest("hex").slice(0, 16)
}

/**
 * Get workspace ID from cwd - uses git root commit hash if in a repo,
 * otherwise hashes the directory path
 */
async function getWorkspaceId(cwd: string): Promise<string> {
	const absoluteCwd = path.resolve(cwd)
	// Try to find git directory
	const gitDir = await findGitDir(absoluteCwd)

	if (gitDir) {
		const gitRoot = path.dirname(gitDir)
		const rootCommit = await getGitRootCommit(gitRoot)

		if (rootCommit) {
			// Use short hash of the root commit
			return rootCommit.slice(0, 16)
		}
	}

	// Fallback: hash the directory path
	return hashString(absoluteCwd)
}

export async function getWorkspaceCachePath(cwd: string) {
	const workspaceId = await getWorkspaceId(cwd)
	const { cache } = getStoragePaths()

	return path.join(cache, workspaceId)
}

/**
 * Read a JSON file, returning null if it doesn't exist or is invalid
 */
export async function readJson<T>(filePath: string): Promise<T | null> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		return JSON.parse(content) as T
	} catch {
		return null
	}
}

export async function writeJson<T>(filePath: string, data: T) {
	await fs.mkdir(path.dirname(filePath), { recursive: true })
	await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

// Chat storage functions

const MAX_TITLE_LENGTH = 50

function truncateTitle(text: string) {
	if (text.length <= MAX_TITLE_LENGTH) return text
	return `${text.slice(0, MAX_TITLE_LENGTH - 3)}...`
}

function getFirstUserPrompt(messages: TUIMessage[]) {
	const userMsg = messages.find((m) => m.role === "user")
	if (!userMsg) return "New Chat"

	const textPart = userMsg.parts.find((p) => p.type === "text") as
		| { type: "text"; text: string }
		| undefined
	return textPart?.text || "New Chat"
}

async function getChatsDir() {
	const cwd = cwdAtom.get()
	const workspacePath = await getWorkspaceCachePath(cwd)

	return path.join(workspacePath, "chats")
}

export function generateChatId() {
	return crypto.randomUUID()
}

export async function saveChat(chat: StoredChat) {
	const chatsDir = await getChatsDir()
	const chatPath = path.join(chatsDir, chat.id, "chat.json")

	await writeJson(chatPath, {
		...chat,
		title: truncateTitle(getFirstUserPrompt(chat.messages)),
		updatedAt: Date.now(),
	})
}

export async function loadChat(chatId: string) {
	const chatsDir = await getChatsDir()
	const chatPath = path.join(chatsDir, chatId, "chat.json")

	return readJson<StoredChat>(chatPath)
}

export async function listChats(): Promise<StoredChat[]> {
	const chatsDir = await getChatsDir()

	try {
		const entries = await fs.readdir(chatsDir, { withFileTypes: true })
		const chatDirs = entries.filter((e) => e.isDirectory())
		const chats: StoredChat[] = []

		for (const dir of chatDirs) {
			const chat = await loadChat(dir.name)
			if (chat) chats.push(chat)
		}

		// Sort by updatedAt descending (most recent first)
		return chats.sort((a, b) => b.updatedAt - a.updatedAt)
	} catch {
		return []
	}
}

export async function createChat() {
	const now = Date.now()
	const chat: StoredChat = {
		id: generateChatId(),
		title: "New Chat",
		messages: [],
		createdAt: now,
		updatedAt: now,
	}
	await saveChat(chat)
	return chat
}

export async function deleteChat(chatId: string) {
	const chatsDir = await getChatsDir()
	const chatPath = path.join(chatsDir, chatId)

	await fs.rm(chatPath, { recursive: true, force: true })
}
