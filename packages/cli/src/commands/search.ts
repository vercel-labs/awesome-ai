import { Command } from "commander"
import path from "path"
import { z } from "zod"
import { getRegistry } from "@/src/registry/api"
import { clearRegistryContext } from "@/src/registry/context"
import { loadEnvFiles } from "@/src/utils/env-loader"
import { createConfig, getConfig } from "@/src/utils/get-config"
import { handleError } from "@/src/utils/handle-error"

const searchOptionsSchema = z.object({
	cwd: z.string(),
	query: z.string().optional(),
	type: z.enum(["agents", "tools", "prompts"]).optional(),
	registry: z.string().optional(),
})

export const search = new Command()
	.name("search")
	.description("search items from registries")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option("-q, --query <query>", "query string")
	.option(
		"-t, --type <type>",
		"the type of item to search (agents, tools, prompts)",
	)
	.option(
		"-r, --registry <registry>",
		"the registry to search from (default: @awesome-ai)",
		"@awesome-ai",
	)
	.action(async (opts) => {
		try {
			const options = searchOptionsSchema.parse({
				cwd: path.resolve(opts.cwd),
				query: opts.query,
				type: opts.type,
				registry: opts.registry,
			})

			await loadEnvFiles(options.cwd)

			let config = await getConfig(options.cwd)
			if (!config) {
				config = createConfig({
					resolvedPaths: {
						cwd: options.cwd,
					},
				})
			}

			const type = options.type || "agents"
			const registry = await getRegistry(
				options.registry || "@awesome-ai",
				type,
				{
					config,
				},
			)

			let items = registry.items
			if (options.query) {
				const query = options.query.toLowerCase()
				items = items.filter(
					(item) =>
						item.name.toLowerCase().includes(query) ||
						item.description?.toLowerCase().includes(query),
				)
			}

			console.log(JSON.stringify(items, null, 2))
			process.exit(0)
		} catch (error) {
			handleError(error)
		} finally {
			clearRegistryContext()
		}
	})
