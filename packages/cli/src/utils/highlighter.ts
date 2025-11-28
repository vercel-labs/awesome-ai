import { blue, cyan, green, red, yellow } from "kleur"

export const highlighter = {
	error: (text: string) => red(text),
	warn: (text: string) => yellow(text),
	info: (text: string) => blue(text),
	success: (text: string) => green(text),
	dim: (text: string) => cyan(text),
}
