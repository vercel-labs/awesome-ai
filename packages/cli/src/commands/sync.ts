import { Command } from "commander"
import path from "path"
import { z } from "zod"
import { getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"
import {
	type ItemType,
	loadNpmPackages,
	processDirectory,
} from "../utils/registry-builder"
import { spinner } from "../utils/spinner"
import { writeRegistryAtPath } from "../utils/write-local-registry"

export const syncOptionsSchema = z.object({
	cwd: z.string(),
	silent: z.boolean(),
	output: z.string().optional(),
})

export const sync = new Command()
	.name("sync")
	.description(
		"regenerate the local .awesome-ai/registry/ from your source files",
	)
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option(
		"-o, --output <path>",
		"output directory for generated registry json files. defaults to agents.json registryDir or .awesome-ai/registry.",
	)
	.option("-s, --silent", "mute output.", false)
	.action(async (opts) => {
		try {
			const options = syncOptionsSchema.parse({
				cwd: path.resolve(opts.cwd),
				silent: opts.silent ?? false,
				output: opts.output ? path.resolve(opts.cwd, opts.output) : undefined,
			})

			const config = await getConfig(options.cwd)
			if (!config) {
				logger.error(
					`No ${highlighter.info("agents.json")} found. Run ${highlighter.info("awesome-ai init")} first.`,
				)
				process.exit(1)
			}

			const syncSpinner = spinner("Scanning source files.", {
				silent: options.silent,
			})?.start()

			const npmPackages = await loadNpmPackages(options.cwd)

			const types: ItemType[] = ["agents", "tools", "prompts"]
			const allItems: Awaited<ReturnType<typeof processDirectory>> = []

			for (const type of types) {
				const baseDir = config.resolvedPaths[type]
				if (!baseDir) continue

				// srcDir is the parent of the type directory
				// e.g. if baseDir is /project/src/agents, srcDir is /project/src
				const srcDir = path.dirname(baseDir)

				const items = await processDirectory(type, baseDir, srcDir, npmPackages)
				allItems.push(...items)
			}

			if (allItems.length === 0) {
				syncSpinner?.info("No source files found.")
				return
			}

			syncSpinner?.succeed(
				`Found ${allItems.length} item${allItems.length !== 1 ? "s" : ""}.`,
			)

			const writeSpinner = spinner("Writing local registry.", {
				silent: options.silent,
			})?.start()

			const outputDir = options.output ?? config.resolvedPaths.registry
			await writeRegistryAtPath(outputDir, allItems)

			writeSpinner?.succeed()

			if (!options.silent) {
				const counts: Record<string, number> = {}
				for (const item of allItems) {
					const type = item.type.replace("registry:", "") + "s"
					counts[type] = (counts[type] || 0) + 1
				}
				const summary = Object.entries(counts)
					.map(([type, count]) => `${count} ${type}`)
					.join(", ")
				logger.info(`Synced ${summary} to ${outputDir}`)
			}
		} catch (error) {
			logger.break()
			handleError(error)
		}
	})
