#!/usr/bin/env bun
import { Command } from "commander"
import { add } from "./commands/add"
import { diff } from "./commands/diff"
import { exec } from "./commands/exec"
import { init } from "./commands/init"
import { list } from "./commands/list"
import { migrate } from "./commands/migrate"
import { run } from "./commands/run"
import { search } from "./commands/search"
import { view } from "./commands/view"
import packageJson from "../package.json"

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

async function main() {
	const program = new Command()
		.name("awesome-ai")
		.description(
			"add agents, tools, and prompts from registries to your project",
		)
		.version(
			packageJson.version || "0.0.0",
			"-v, --version",
			"display the version number",
		)

	program
		.addCommand(init)
		.addCommand(add)
		.addCommand(list)
		.addCommand(run)
		.addCommand(exec)
		.addCommand(migrate)
		.addCommand(search)
		.addCommand(view)
		.addCommand(diff)

	program.parse()
}

main()
