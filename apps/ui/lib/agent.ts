import { FileStorage } from "./storage/file-storage"

export const agentDB = new FileStorage({
	baseDir: ".agent",
})
