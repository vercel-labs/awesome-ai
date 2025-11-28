import { createHash } from "crypto"
import deepmerge from "deepmerge"
import path from "path"
import { z } from "zod"
import { buildUrlAndHeadersForRegistryItem } from "@/src/registry/builder"
import { setRegistryHeaders } from "@/src/registry/context"
import {
	RegistryNotConfiguredError,
	RegistryParseError,
} from "@/src/registry/errors"
import { fetchRegistry, fetchRegistryLocal } from "@/src/registry/fetcher"
import { parseRegistryAndItemFromString } from "@/src/registry/parser"
import {
	type RegistryItem,
	registryItemSchema,
	registryResolvedItemsTreeSchema,
} from "@/src/registry/schema"
import { isLocalFile, isUrl } from "@/src/registry/utils"
import type { Config } from "@/src/schema"

const registryItemWithSourceSchema = registryItemSchema.extend({
	_source: z.string().optional(),
})

export function resolveRegistryItemsFromRegistries(
	items: string[],
	type: "agents" | "tools" | "prompts",
	config: Config,
) {
	const registryHeaders: Record<string, Record<string, string>> = {}
	const resolvedItems = [...items]

	if (!config?.registries) {
		setRegistryHeaders({})
		return resolvedItems
	}

	for (let i = 0; i < resolvedItems.length; i++) {
		const resolved = buildUrlAndHeadersForRegistryItem(
			resolvedItems[i],
			type,
			config,
		)

		if (resolved) {
			resolvedItems[i] = resolved.url

			if (Object.keys(resolved.headers).length > 0) {
				registryHeaders[resolved.url] = resolved.headers
			}
		}
	}

	setRegistryHeaders(registryHeaders)

	return resolvedItems
}

export async function fetchRegistryItems(
	items: string[],
	type: "agents" | "tools" | "prompts",
	config: Config,
	options: { useCache?: boolean } = {},
) {
	const results = await Promise.all(
		items.map(async (item) => {
			if (isLocalFile(item)) {
				return fetchRegistryLocal(item)
			}

			if (isUrl(item)) {
				const [result] = await fetchRegistry([item], options)
				try {
					return registryItemSchema.parse(result)
				} catch (error) {
					throw new RegistryParseError(item, error)
				}
			}

			if (item.startsWith("@") && config?.registries) {
				const paths = resolveRegistryItemsFromRegistries([item], type, config)
				const [result] = await fetchRegistry(paths, options)
				try {
					return registryItemSchema.parse(result)
				} catch (error) {
					throw new RegistryParseError(item, error)
				}
			}

			const path = `${type}/${item}.json`
			const [result] = await fetchRegistry([path], options)
			try {
				return registryItemSchema.parse(result)
			} catch (error) {
				throw new RegistryParseError(item, error)
			}
		}),
	)

	return results
}

export async function resolveRegistryTree(
	names: string[],
	type: "agents" | "tools" | "prompts",
	config: Config,
	options: { useCache?: boolean } = {},
) {
	options = {
		useCache: true,
		...options,
	}

	let payload: z.infer<typeof registryItemWithSourceSchema>[] = []
	const allDependencyItems: z.infer<typeof registryItemWithSourceSchema>[] = []

	const uniqueNames = Array.from(new Set(names))

	const results = await fetchRegistryItems(uniqueNames, type, config, options)

	const resultMap = new Map<string, RegistryItem>()
	for (let i = 0; i < results.length; i++) {
		if (results[i]) {
			resultMap.set(uniqueNames[i], results[i])
		}
	}

	for (const [sourceName, item] of Array.from(resultMap.entries())) {
		const itemWithSource: z.infer<typeof registryItemWithSourceSchema> = {
			...item,
			_source: sourceName,
		}
		payload.push(itemWithSource)

		if (item.registryDependencies) {
			let resolvedDependencies = item.registryDependencies

			if (!config?.registries) {
				const namespacedDeps = item.registryDependencies.filter((dep: string) =>
					dep.startsWith("@"),
				)
				if (namespacedDeps.length > 0) {
					const { registry } = parseRegistryAndItemFromString(namespacedDeps[0])
					throw new RegistryNotConfiguredError(registry)
				}
			} else {
				resolvedDependencies = resolveRegistryItemsFromRegistries(
					item.registryDependencies,
					type,
					config,
				)
			}

			const { items } = await resolveDependenciesRecursively(
				resolvedDependencies,
				type,
				config,
				options,
				new Set(uniqueNames),
			)
			allDependencyItems.push(...items)
		}
	}

	payload.push(...allDependencyItems)

	const sourceMap = new Map<RegistryItem, string>()
	payload.forEach((item) => {
		const source = item._source || item.name
		sourceMap.set(item, source)
	})

	payload = topologicalSortRegistryItems(payload, sourceMap)

	const parsed = registryResolvedItemsTreeSchema.parse({
		dependencies: deepmerge.all(payload.map((item) => item.dependencies ?? [])),
		devDependencies: deepmerge.all(
			payload.map((item) => item.devDependencies ?? []),
		),
		files: deduplicateFilesByTarget(payload.map((item) => item.files ?? [])),
		docs: payload.map((item) => item.docs || "").join("\n"),
	})

	return parsed
}

async function resolveDependenciesRecursively(
	dependencies: string[],
	type: "agents" | "tools" | "prompts",
	config: Config,
	options: { useCache?: boolean } = {},
	visited: Set<string> = new Set(),
) {
	const items: RegistryItem[] = []

	for (const dep of dependencies) {
		if (visited.has(dep)) {
			continue
		}
		visited.add(dep)

		if (isUrl(dep) || isLocalFile(dep)) {
			const [item] = await fetchRegistryItems([dep], type, config, options)
			if (item) {
				items.push(item)
				if (item.registryDependencies) {
					const resolvedDeps = config?.registries
						? resolveRegistryItemsFromRegistries(
								item.registryDependencies,
								type,
								config,
							)
						: item.registryDependencies

					const nested = await resolveDependenciesRecursively(
						resolvedDeps,
						type,
						config,
						options,
						visited,
					)
					items.push(...nested.items)
				}
			}
		} else if (dep.startsWith("@") && config?.registries) {
			const { registry } = parseRegistryAndItemFromString(dep)
			if (registry && !(registry in config.registries)) {
				throw new RegistryNotConfiguredError(registry)
			}

			const [item] = await fetchRegistryItems([dep], type, config, options)
			if (item) {
				items.push(item)
				if (item.registryDependencies) {
					const resolvedDeps = config?.registries
						? resolveRegistryItemsFromRegistries(
								item.registryDependencies,
								type,
								config,
							)
						: item.registryDependencies

					const nested = await resolveDependenciesRecursively(
						resolvedDeps,
						type,
						config,
						options,
						visited,
					)
					items.push(...nested.items)
				}
			}
		} else {
			try {
				const [item] = await fetchRegistryItems([dep], type, config, options)
				if (item && item.registryDependencies) {
					const resolvedDeps = config?.registries
						? resolveRegistryItemsFromRegistries(
								item.registryDependencies,
								type,
								config,
							)
						: item.registryDependencies

					const nested = await resolveDependenciesRecursively(
						resolvedDeps,
						type,
						config,
						options,
						visited,
					)
					items.push(...nested.items)
				}
			} catch {
				// If we can't fetch the registry item, that's okay
			}
		}
	}

	return { items }
}

function computeItemHash(item: Pick<RegistryItem, "name">, source?: string) {
	const identifier = source || item.name

	const hash = createHash("sha256")
		.update(identifier)
		.digest("hex")
		.substring(0, 8)

	return `${item.name}::${hash}`
}

function extractItemIdentifierFromDependency(dependency: string) {
	if (isUrl(dependency)) {
		const url = new URL(dependency)
		const pathname = url.pathname
		const match = pathname.match(/\/([^/]+)\.json$/)
		const name = match ? match[1] : path.basename(pathname, ".json")

		return {
			name,
			hash: computeItemHash({ name }, dependency),
		}
	}

	if (isLocalFile(dependency)) {
		const match = dependency.match(/\/([^/]+)\.json$/)
		const name = match ? match[1] : path.basename(dependency, ".json")

		return {
			name,
			hash: computeItemHash({ name }, dependency),
		}
	}

	const { item } = parseRegistryAndItemFromString(dependency)
	return {
		name: item,
		hash: computeItemHash({ name: item }, dependency),
	}
}

function topologicalSortRegistryItems(
	items: z.infer<typeof registryItemWithSourceSchema>[],
	sourceMap: Map<RegistryItem, string>,
) {
	const itemMap = new Map<string, RegistryItem>()
	const hashToItem = new Map<string, RegistryItem>()
	const inDegree = new Map<string, number>()
	const adjacencyList = new Map<string, string[]>()

	items.forEach((item) => {
		const source = sourceMap.get(item) || item.name
		const hash = computeItemHash(item, source)

		itemMap.set(hash, item)
		hashToItem.set(hash, item)
		inDegree.set(hash, 0)
		adjacencyList.set(hash, [])
	})

	const depToHashes = new Map<string, string[]>()
	items.forEach((item) => {
		const source = sourceMap.get(item) || item.name
		const hash = computeItemHash(item, source)

		if (!depToHashes.has(item.name)) {
			depToHashes.set(item.name, [])
		}
		depToHashes.get(item.name)!.push(hash)

		if (source !== item.name) {
			if (!depToHashes.has(source)) {
				depToHashes.set(source, [])
			}
			depToHashes.get(source)!.push(hash)
		}
	})

	items.forEach((item) => {
		const itemSource = sourceMap.get(item) || item.name
		const itemHash = computeItemHash(item, itemSource)

		if (item.registryDependencies) {
			item.registryDependencies.forEach((dep) => {
				let depHash: string | undefined

				const exactMatches = depToHashes.get(dep) || []
				if (exactMatches.length === 1) {
					depHash = exactMatches[0]
				} else if (exactMatches.length > 1) {
					depHash = exactMatches[0]
				} else {
					const { name } = extractItemIdentifierFromDependency(dep)
					const nameMatches = depToHashes.get(name) || []
					if (nameMatches.length > 0) {
						depHash = nameMatches[0]
					}
				}

				if (depHash && itemMap.has(depHash)) {
					adjacencyList.get(depHash)!.push(itemHash)
					inDegree.set(itemHash, inDegree.get(itemHash)! + 1)
				}
			})
		}
	})

	const queue: string[] = []
	const sorted: z.infer<typeof registryItemWithSourceSchema>[] = []

	inDegree.forEach((degree, hash) => {
		if (degree === 0) {
			queue.push(hash)
		}
	})

	while (queue.length > 0) {
		const currentHash = queue.shift()!
		const item = itemMap.get(currentHash)!
		sorted.push(item as z.infer<typeof registryItemWithSourceSchema>)

		adjacencyList.get(currentHash)!.forEach((dependentHash) => {
			const newDegree = inDegree.get(dependentHash)! - 1
			inDegree.set(dependentHash, newDegree)

			if (newDegree === 0) {
				queue.push(dependentHash)
			}
		})
	}

	if (sorted.length !== items.length) {
		const missingHashes = Array.from(itemMap.keys()).filter(
			(hash) =>
				!sorted.some(
					(item) => computeItemHash(item, sourceMap.get(item)) === hash,
				),
		)
		console.warn(
			`Warning: Circular dependencies detected. Some items may not be sorted correctly: ${missingHashes.join(", ")}`,
		)
	}

	return sorted
}

function deduplicateFilesByTarget(
	filesArrays: Array<RegistryItem["files"] | undefined>,
) {
	const seen = new Map<string, RegistryItem["files"][number]>()
	const result: RegistryItem["files"] = []

	for (const files of filesArrays) {
		if (!files) continue

		for (const file of files) {
			const key = file.target || file.path
			if (!seen.has(key)) {
				seen.set(key, file)
				result.push(file)
			}
		}
	}

	return result
}
