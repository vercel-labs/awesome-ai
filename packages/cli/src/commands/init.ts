import { Command } from "commander"
import { promises as fs } from "fs"
import path from "path"
import prompts from "prompts"
import { z } from "zod"
import { preFlightInit } from "../preflights/preflight-init"
import { BUILTIN_REGISTRIES } from "../registry/constants"
import { clearRegistryContext } from "../registry/context"
import { rawConfigSchema } from "../schema"
import { getConfig, resolveConfigPaths } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"
import { spinner } from "../utils/spinner"

export const initOptionsSchema = z.object({
	cwd: z.string(),
	yes: z.boolean(),
	defaults: z.boolean(),
	silent: z.boolean(),
})

export const init = new Command()
	.name("init")
	.description("initialize your project and install dependencies")
	.option("-y, --yes", "skip confirmation prompt.", true)
	.option("-d, --defaults", "use default configuration.", false)
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.option("-s, --silent", "mute output.", false)
	.action(async (opts) => {
		try {
			const options = initOptionsSchema.parse({
				cwd: path.resolve(opts.cwd),
				...opts,
			})

			await runInit(options)

			logger.log(
				`${highlighter.success(
					"Success!",
				)} Project initialization completed.\nYou may now add agents, tools, and prompts.`,
			)
			logger.break()
		} catch (error) {
			logger.break()
			handleError(error)
		} finally {
			clearRegistryContext()
		}
	})

export async function runInit(options: z.infer<typeof initOptionsSchema>) {
	await preFlightInit({ ...options, force: false })

	const existingConfig = await getConfig(options.cwd)

	const config = existingConfig
		? await promptForMinimalConfig(existingConfig, options)
		: await promptForConfig(options)

	if (!options.yes) {
		const { proceed } = await prompts({
			type: "confirm",
			name: "proceed",
			message: `Write configuration to ${highlighter.info(
				"agents.json",
			)}. Proceed?`,
			initial: true,
		})

		if (!proceed) {
			process.exit(0)
		}
	}

	const configSpinner = spinner(`Writing agents.json.`).start()
	const targetPath = path.resolve(options.cwd, "agents.json")

	config.registries = Object.fromEntries(
		Object.entries(config.registries || {}).filter(
			([key]) => !Object.keys(BUILTIN_REGISTRIES).includes(key),
		),
	)

	await fs.writeFile(targetPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
	configSpinner.succeed()

	return await resolveConfigPaths(options.cwd, config)
}

async function promptForConfig(opts: z.infer<typeof initOptionsSchema>) {
	// Skip prompts if defaults flag is set
	if (opts.defaults) {
		return rawConfigSchema.parse({
			$schema: "https://awesome-ai.com/schema.json",
			tsx: true,
			aliases: {
				agents: "@/agents",
				tools: "@/tools",
				prompts: "@/prompts",
			},
			registries: BUILTIN_REGISTRIES,
		})
	}

	logger.info("")
	const options = await prompts([
		{
			type: "toggle",
			name: "typescript",
			message: `Would you like to use ${highlighter.info(
				"TypeScript",
			)} (recommended)?`,
			initial: true,
			active: "yes",
			inactive: "no",
		},
		{
			type: "text",
			name: "agents",
			message: `Configure the import alias for ${highlighter.info("agents")}:`,
			initial: "@/agents",
		},
		{
			type: "text",
			name: "tools",
			message: `Configure the import alias for ${highlighter.info("tools")}:`,
			initial: "@/tools",
		},
		{
			type: "text",
			name: "prompts",
			message: `Configure the import alias for ${highlighter.info("prompts")}:`,
			initial: "@/prompts",
		},
	])

	return rawConfigSchema.parse({
		$schema: "https://awesome-ai.com/schema.json",
		tsx: options.typescript ?? true,
		aliases: {
			agents: options.agents ?? "@/agents",
			tools: options.tools ?? "@/tools",
			prompts: options.prompts ?? "@/prompts",
		},
		registries: BUILTIN_REGISTRIES,
	})
}

async function promptForMinimalConfig(
	existingConfig: z.infer<typeof rawConfigSchema>,
	opts: z.infer<typeof initOptionsSchema>,
) {
	// If --defaults is passed, use default values
	if (opts.defaults) {
		return rawConfigSchema.parse({
			$schema: "https://awesome-ai.com/schema.json",
			tsx: true,
			aliases: {
				agents: "@/agents",
				tools: "@/tools",
				prompts: "@/prompts",
			},
			registries: BUILTIN_REGISTRIES,
		})
	}

	const options = await prompts([
		{
			type: "text",
			name: "agents",
			message: `Configure the import alias for ${highlighter.info("agents")}:`,
			initial: existingConfig.aliases.agents,
		},
		{
			type: "text",
			name: "tools",
			message: `Configure the import alias for ${highlighter.info("tools")}:`,
			initial: existingConfig.aliases.tools,
		},
		{
			type: "text",
			name: "prompts",
			message: `Configure the import alias for ${highlighter.info("prompts")}:`,
			initial: existingConfig.aliases.prompts,
		},
	])

	return rawConfigSchema.parse({
		...existingConfig,
		aliases: {
			agents: options.agents ?? existingConfig.aliases.agents,
			tools: options.tools ?? existingConfig.aliases.tools,
			prompts: options.prompts ?? existingConfig.aliases.prompts,
		},
	})
}
