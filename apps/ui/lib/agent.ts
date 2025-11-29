import { FileStorage } from "@awesome-ai/registry"

export const agentDB = new FileStorage({
	baseDir: ".agent",
})
