import { Command } from "commander"
import path from "path"
import { z } from "zod"
import { getRegistry } from "../registry/api"
import { clearRegistryContext } from "../registry/context"
import { loadEnvFiles } from "../utils/env-loader"
import { createConfig, getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"

const listOptionsSchema = z.object({
	cwd: z.string(),
	type: z.enum(["agents", "tools", "prompts"]).optional(),
	registry: z.string().optional(),
})

export const list = new Command()
	.name("list")
	.description("list available items from registries")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option(
		"-t, --type <type>",
		"the type of item to list (agents, tools, prompts)",
	)
	.option(
		"-r, --registry <registry>",
		"the registry to list from (default: @awesome-ai)",
		"@awesome-ai",
	)
	.action(async (opts) => {
		try {
			const options = listOptionsSchema.parse({
				cwd: path.resolve(opts.cwd),
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

			console.log(JSON.stringify(registry.items, null, 2))
			process.exit(0)
		} catch (error) {
			handleError(error)
		} finally {
			clearRegistryContext()
		}
	})
