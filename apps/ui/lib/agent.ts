import { FileStorage } from "coding-agent"

export const agentDB = new FileStorage({
	baseDir: ".agent",
})
