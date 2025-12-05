import { Command } from "commander"
import path from "path"
import { z } from "zod"
import { getRegistryItems } from "../registry/api"
import { clearRegistryContext } from "../registry/context"
import { loadEnvFiles } from "../utils/env-loader"
import { createConfig, getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"

const viewOptionsSchema = z.object({
	cwd: z.string(),
	type: z.enum(["agents", "tools", "prompts"]).optional(),
})

export const view = new Command()
	.name("view")
	.description("view item details from the registry")
	.argument("<items...>", "the item names to view")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option("-t, --type <type>", "the type of item (agents, tools, prompts)")
	.action(async (items: string[], opts) => {
		try {
			const options = viewOptionsSchema.parse({
				cwd: path.resolve(opts.cwd),
				type: opts.type,
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

			if (!options.type) {
				throw new Error(
					"Please specify the type using --type (agents, tools, or prompts).",
				)
			}

			const payload = await getRegistryItems(items, options.type, {
				config,
			})
			console.log(JSON.stringify(payload, null, 2))
			process.exit(0)
		} catch (error) {
			handleError(error)
		} finally {
			clearRegistryContext()
		}
	})
