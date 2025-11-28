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
	type: z.enum(["agents", "tools", "prompts"]).optional(),
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
	.option("-t, --type <type>", "the type of item (agents, tools, prompts)")
	.action(async (items, opts) => {
		try {
			const options = addOptionsSchema.parse({
				items,
				cwd: path.resolve(opts.cwd),
				type: opts.type,
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

			if (!options.type) {
				logger.error(
					"Please specify the type using --type (agents, tools, or prompts).",
				)
				process.exit(1)
			}

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
					force: true,
					defaults: false,
					silent: options.silent,
				})
			}

			if (!config) {
				throw new Error(
					`Failed to read config at ${highlighter.info(options.cwd)}.`,
				)
			}

			await addItems(options.items, options.type, config, {
				overwrite: options.overwrite,
				silent: options.silent,
			})
		} catch (error) {
			logger.break()
			handleError(error)
		} finally {
			clearRegistryContext()
		}
	})
