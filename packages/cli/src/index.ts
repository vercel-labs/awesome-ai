#!/usr/bin/env bun
import { Command } from "commander"
import { add } from "@/src/commands/add"
import { diff } from "@/src/commands/diff"
import { exec } from "@/src/commands/exec"
import { init } from "@/src/commands/init"
import { list } from "@/src/commands/list"
import { run } from "@/src/commands/run"
import { search } from "@/src/commands/search"
import { view } from "@/src/commands/view"
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
		.addCommand(search)
		.addCommand(view)
		.addCommand(diff)

	program.parse()
}

main()
