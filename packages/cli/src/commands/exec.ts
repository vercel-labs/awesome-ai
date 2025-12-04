import { Command } from "commander"
import path from "path"
import { runTui } from "tui"
import { z } from "zod"
import { getConfig } from "@/src/utils/get-config"
import { handleError } from "@/src/utils/handle-error"
import { logger } from "@/src/utils/logger"

export const execOptionsSchema = z.object({
	promptName: z.string().min(1, "Prompt name is required"),
	agent: z.string().optional(),
	cwd: z.string(),
})

export const exec = new Command()
	.name("exec")
	.description("execute a prompt with an agent after approval")
	.argument("<prompt>", "name of the prompt to execute")
	.argument("[agent]", "name of the agent to use (defaults to first available)")
	.option(
		"-c, --cwd <cwd>",
		"the working directory. defaults to the current directory.",
		process.cwd(),
	)
	.action(async (promptName: string, agent: string | undefined, opts) => {
		try {
			const options = execOptionsSchema.parse({
				promptName,
				agent,
				cwd: path.resolve(opts.cwd),
			})

			// Read agents.json and resolve paths
			const config = await getConfig(options.cwd)

			if (!config) {
				logger.error(
					`agents.json not found in ${options.cwd}. Run 'awesome-ai init' to create one.`,
				)
				process.exit(1)
			}

			const agentsPath = config.resolvedPaths.agents
			const promptsPath = config.resolvedPaths.prompts

			if (!agentsPath) {
				logger.error("Could not resolve agents path from agents.json")
				process.exit(1)
			}

			if (!promptsPath) {
				logger.error("Could not resolve prompts path from agents.json")
				process.exit(1)
			}

			await runTui({
				agentsPath,
				promptsPath,
				promptName: options.promptName,
				initialAgent: options.agent,
				cwd: options.cwd,
			})
		} catch (error) {
			logger.break()
			handleError(error)
		}
	})
