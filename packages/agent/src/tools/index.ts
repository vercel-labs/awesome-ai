import type { ToolSet } from "ai"
import { bashTool } from "./bash"
import { editTool } from "./edit"
import { globTool } from "./glob"
import { grepTool } from "./grep"
import { listTool } from "./list"
import { readTool } from "./read"
import { writeTool } from "./write"

export { bashTool, editTool, globTool, grepTool, listTool, readTool, writeTool }

export const tools = {
	read: readTool,
	write: writeTool,
	edit: editTool,
	bash: bashTool,
	list: listTool,
	grep: grepTool,
	glob: globTool,
} satisfies ToolSet
