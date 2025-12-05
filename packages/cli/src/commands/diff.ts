import { Command } from "commander"
import { type Change, diffLines } from "diff"
import { existsSync, promises as fs } from "fs"
import path from "path"
import { z } from "zod"
import { getRegistryItems } from "../registry/api"
import { clearRegistryContext } from "../registry/context"
import { loadEnvFiles } from "../utils/env-loader"
import { createConfig, getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"
import { transformImports } from "../utils/transform-import"

const diffOptionsSchema = z.object({
	item: z.string().optional(),
	type: z.enum(["agents", "tools", "prompts"]).optional(),
	cwd: z.string(),
})

export const diff = new Command()
	.name("diff")
	.description("check for updates against the registry")
	.argument("[item]", "the item name")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option("-t, --type <type>", "the type of item (agents, tools, prompts)")
	.action(async (name, opts) => {
		try {
			const options = diffOptionsSchema.parse({
				item: name,
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

			if (!options.item || !options.type) {
				logger.error("Please specify both item name and type using --type.")
				process.exit(1)
			}

			const [registryItem] = await getRegistryItems(
				[options.item],
				options.type,
				{ config },
			)

			if (!registryItem) {
				logger.error(`Item ${options.item} not found in registry.`)
				process.exit(1)
			}

			for (const file of registryItem.files) {
				const filePath = path.resolve(
					config.resolvedPaths[options.type],
					file.path.replace(new RegExp(`^${options.type}/`), ""),
				)

				if (!existsSync(filePath)) {
					logger.info(`File ${filePath} does not exist locally.`)
					continue
				}

				const localContent = await fs.readFile(filePath, "utf-8")
				const transformedContent = await transformImports({
					filename: file.path,
					raw: file.content,
					config,
					isRemote: false,
				})

				const diff = diffLines(localContent, transformedContent)
				if (diff.length > 1) {
					logger.info(`\nFile: ${highlighter.info(file.path)}`)
					printDiff(diff)
				}
			}
		} catch (error) {
			handleError(error)
		} finally {
			clearRegistryContext()
		}
	})

function printDiff(diff: Change[]) {
	for (const part of diff) {
		if (part) {
			if (part.added) {
				process.stdout.write(highlighter.success(part.value))
			} else if (part.removed) {
				process.stdout.write(highlighter.error(part.value))
			} else {
				process.stdout.write(part.value)
			}
		}
	}
}
