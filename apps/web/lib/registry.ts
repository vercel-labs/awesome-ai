import { promises as fs } from "fs"
import path from "path"

/**
 * In development, read registry JSON from the local monorepo.
 * In production, fetch from the remote registry URL.
 */

const REGISTRY_URL = process.env.REGISTRY_URL
const LOCAL_REGISTRY_DIR = path.resolve(process.cwd(), "../../packages/registry/registry")

const isLocal = !REGISTRY_URL

export async function fetchRegistryFile<T>(registryPath: string): Promise<T> {
	if (isLocal) {
		const filePath = path.join(LOCAL_REGISTRY_DIR, registryPath)
		const content = await fs.readFile(filePath, "utf-8")
		return JSON.parse(content) as T
	}

	const url = `${REGISTRY_URL}/${registryPath}`
	const res = await fetch(url, { next: { revalidate: 60 } })

	if (!res.ok) {
		throw new Error(`Failed to fetch registry: ${url} (${res.status})`)
	}

	return res.json() as Promise<T>
}
