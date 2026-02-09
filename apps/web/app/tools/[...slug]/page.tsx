import { ArrowLeft, Box, Package, Terminal } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/header"
import { CliCommand } from "@/components/cli-command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllTools, getToolBySlug } from "@/lib/tools"
import { getAllAgents } from "@/lib/agents"

export async function generateStaticParams() {
	const tools = await getAllTools()
	return tools.map((tool) => ({
		slug: tool.name.split("/"),
	}))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string[] }>
}) {
	const { slug } = await params
	const toolSlug = slug.join("/")
	const tool = await getToolBySlug(toolSlug)
	if (!tool) return { title: "Tool Not Found" }
	return {
		title: `${tool.title} - awesome-ai`,
		description: tool.description,
	}
}

export default async function ToolPage({
	params,
}: {
	params: Promise<{ slug: string[] }>
}) {
	const { slug } = await params
	const toolSlug = slug.join("/")
	const tool = await getToolBySlug(toolSlug)

	if (!tool) {
		notFound()
	}

	const agents = await getAllAgents()
	const usedByAgents = agents.filter((agent) =>
		agent.tools.includes(tool.name),
	)

	const mainFile = tool.files.find((f) => f.type === "registry:tool")

	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="max-w-5xl mx-auto px-4 py-8">
				{/* Breadcrumb */}
				<Button variant="ghost" size="sm" asChild className="mb-8">
					<Link href="/">
						<ArrowLeft className="h-4 w-4" />
						Back to agents
					</Link>
				</Button>

				{/* Tool Header */}
				<div className="mb-8">
					<div className="flex items-center gap-3 mb-4">
						<h1 className="text-2xl md:text-3xl font-bold text-foreground">
							{tool.title}
						</h1>
						<Badge variant="outline">tool</Badge>
					</div>
					<p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
						{tool.description}
					</p>
				</div>

				{/* Install Section */}
				<div className="mb-12">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<span className="text-primary">{">"}</span>
								Install with CLI
							</CardTitle>
						</CardHeader>
						<CardContent>
							<CliCommand command={`awesome-ai add ${tool.name}`} />
							<p className="mt-4 text-xs text-muted-foreground">
								Run this command in your project directory to install this
								tool.
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Dependencies Section */}
				{tool.dependencies.length > 0 && (
					<div className="mb-12">
						<h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
							<Package className="h-5 w-5 text-primary" />
							Dependencies
						</h2>
						<div className="flex flex-wrap gap-2">
							{tool.dependencies.map((dep) => (
								<Badge key={dep} variant="outline">
									{dep}
								</Badge>
							))}
						</div>
					</div>
				)}

				{/* Used by Agents Section */}
				{usedByAgents.length > 0 && (
					<div className="mb-12">
						<h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
							<Box className="h-5 w-5 text-primary" />
							Used by
						</h2>
						<div className="grid gap-3">
							{usedByAgents.map((agent) => (
								<Link
									key={agent.name}
									href={`/agents/${agent.name}`}
									className="group flex items-center gap-3 p-3 rounded border border-border bg-card hover:border-primary/50 hover:bg-secondary/50 transition-all"
								>
									<Terminal className="h-4 w-4 text-primary shrink-0" />
									<div className="flex-1 min-w-0">
										<span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
											{agent.title}
										</span>
										<p className="text-xs text-muted-foreground truncate">
											{agent.description}
										</p>
									</div>
								</Link>
							))}
						</div>
					</div>
				)}

				{/* Source Code Section */}
				{mainFile && (
					<div className="mb-12">
						<h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
							<span className="text-primary">{"$"}</span>
							Source
						</h2>
						<Card className="overflow-x-auto">
							<CardHeader className="pb-2">
								<code className="text-xs text-muted-foreground">
									{mainFile.path}
								</code>
							</CardHeader>
							<CardContent>
								<pre className="text-sm leading-relaxed overflow-x-auto">
									<code>{mainFile.content}</code>
								</pre>
							</CardContent>
						</Card>
					</div>
				)}
			</main>

			{/* Footer */}
			<footer className="border-t border-border py-8 mt-16">
				<div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
					<p>
						Built with <span className="text-primary">awesome-ai</span>
					</p>
				</div>
			</footer>
		</div>
	)
}
