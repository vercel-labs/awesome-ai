import { Command } from "commander"
import path from "path"
import prompts from "prompts"
import { z } from "zod"
import { runInit } from "@/src/commands/init"
import { preFlightAdd } from "@/src/preflights/preflight-add"
import { clearRegistryContext } from "@/src/registry/context"
import { addItems } from "@/src/utils/add-items"
import { loadEnvFiles } from "@/src/utils/env-loader"
import * as ERRORS from "@/src/utils/errors"
import { createConfig, getConfig } from "@/src/utils/get-config"
import { handleError } from "@/src/utils/handle-error"
import { highlighter } from "@/src/utils/highlighter"
import { logger } from "@/src/utils/logger"

export const addOptionsSchema = z.object({
	items: z.array(z.string()).optional(),
	tool: z.boolean(),
	prompt: z.boolean(),
	yes: z.boolean(),
	overwrite: z.boolean(),
	cwd: z.string(),
	silent: z.boolean(),
})

export const add = new Command()
	.name("add")
	.description("add an agent, tool, or prompt to your project")
	.argument("[items...]", "names of items to add")
	.option("-y, --yes", "skip confirmation prompt.", false)
	.option("-o, --overwrite", "overwrite existing files.", false)
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option("-s, --silent", "mute output.", false)
	.option("--tool", "add a tool (default: agent)")
	.option("--prompt", "add a prompt (default: agent)")
	.action(async (items, opts) => {
		try {
			const options = addOptionsSchema.parse({
				items,
				cwd: path.resolve(opts.cwd),
				tool: opts.tool ?? false,
				prompt: opts.prompt ?? false,
				...opts,
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

			if (!options.items?.length) {
				logger.error("Please specify at least one item to add.")
				process.exit(1)
			}

			// Determine the type: --tool -> tools, --prompt -> prompts, default -> agents
			const type = options.tool
				? "tools"
				: options.prompt
					? "prompts"
					: "agents"
			const { errors } = await preFlightAdd(options)

			if (errors[ERRORS.MISSING_CONFIG]) {
				const { proceed } = await prompts({
					type: "confirm",
					name: "proceed",
					message: `You need to create a ${highlighter.info(
						"agents.json",
					)} file to add items. Proceed?`,
					initial: true,
				})

				if (!proceed) {
					logger.break()
					process.exit(1)
				}

				config = await runInit({
					cwd: options.cwd,
					yes: true,
					defaults: false,
					silent: options.silent,
				})
			}

			if (!config) {
				throw new Error(
					`Failed to read config at ${highlighter.info(options.cwd)}.`,
				)
			}

			await addItems(options.items, type, config, {
				overwrite: options.overwrite,
				silent: options.silent,
				yes: options.yes,
			})
		} catch (error) {
			logger.break()
			handleError(error)
		} finally {
			clearRegistryContext()
		}
	})
