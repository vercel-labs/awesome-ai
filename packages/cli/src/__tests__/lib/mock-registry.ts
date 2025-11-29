import { promises as fs } from "fs"
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "http"
import path from "path"

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures")

interface MockRegistry {
	url: string
	port: number
	server: Server
	stop: () => Promise<void>
	getReceivedHeaders: () => Record<string, string | string[] | undefined>[]
	clearReceivedHeaders: () => void
}

let activeRegistry: MockRegistry | null = null
let receivedHeaders: Record<string, string | string[] | undefined>[] = []

/**
 * Start a mock registry server that serves fixtures
 */
export async function startMockRegistry(): Promise<MockRegistry> {
	// Stop any existing registry first
	if (activeRegistry) {
		await stopMockRegistry()
	}

	// Clear headers from previous runs
	receivedHeaders = []

	return new Promise((resolve, reject) => {
		const server = createServer(
			async (req: IncomingMessage, res: ServerResponse) => {
				// Capture headers for each request
				receivedHeaders.push({ ...req.headers })

				const url = new URL(req.url || "/", `http://localhost`)
				const filePath = path.join(FIXTURES_DIR, url.pathname)

				try {
					const content = await fs.readFile(filePath, "utf-8")
					res.writeHead(200, { "Content-Type": "application/json" })
					res.end(content)
				} catch {
					res.writeHead(404, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ error: "Not found", path: url.pathname }))
				}
			},
		)

		// Set up timeout for server to prevent hanging
		server.timeout = 5000
		server.keepAliveTimeout = 1000

		server.listen(0, "127.0.0.1", () => {
			const address = server.address()
			if (!address || typeof address === "string") {
				reject(new Error("Failed to get server address"))
				return
			}

			const registry: MockRegistry = {
				url: `http://127.0.0.1:${address.port}`,
				port: address.port,
				server,
				stop: async () => {
					return new Promise<void>((resolveStop) => {
						server.closeAllConnections()
						server.close(() => resolveStop())
						// Force resolve after 1 second to prevent hanging
						setTimeout(resolveStop, 1000)
					})
				},
				getReceivedHeaders: () => [...receivedHeaders],
				clearReceivedHeaders: () => {
					receivedHeaders = []
				},
			}

			activeRegistry = registry
			resolve(registry)
		})

		server.on("error", reject)
	})
}

/**
 * Stop the active mock registry
 */
export async function stopMockRegistry(): Promise<void> {
	if (activeRegistry) {
		await activeRegistry.stop()
		activeRegistry = null
	}
}

/**
 * Get the URL for a registry item
 */
export function getRegistryUrl(type: string, name: string): string {
	if (!activeRegistry) {
		throw new Error("Mock registry not started")
	}
	return `${activeRegistry.url}/${type}/${name}.json`
}

/**
 * Get the base registry URL pattern for config
 */
export function getRegistryPattern(): string {
	if (!activeRegistry) {
		throw new Error("Mock registry not started")
	}
	return `${activeRegistry.url}/{type}/{name}.json`
}
