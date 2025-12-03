import { Command } from "commander"
import path from "path"
import { runTui } from "tui"
import { z } from "zod"
import { getConfig } from "@/src/utils/get-config"
import { handleError } from "@/src/utils/handle-error"
import { logger } from "@/src/utils/logger"

export const runOptionsSchema = z.object({
	agent: z.string().optional(),
	cwd: z.string(),
})

export const run = new Command()
	.name("run")
	.description("start an interactive TUI chat with an agent")
	.argument("[agent]", "name of the agent to run")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.action(async (agent, opts) => {
		try {
			const options = runOptionsSchema.parse({
				agent,
				cwd: path.resolve(opts.cwd),
			})

			// Read agents.json and resolve the agents path
			const config = await getConfig(options.cwd)

			if (!config) {
				logger.error(
					`agents.json not found in ${options.cwd}. Run 'awesome-ai init' to create one.`,
				)
				process.exit(1)
			}

			const agentsPath = config.resolvedPaths.agents

			if (!agentsPath) {
				logger.error("Could not resolve agents path from agents.json")
				process.exit(1)
			}

			await runTui({
				agentsPath,
				initialAgent: options.agent,
				cwd: options.cwd,
			})
		} catch (error) {
			logger.break()
			handleError(error)
		}
	})
