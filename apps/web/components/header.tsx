import { Terminal } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Header() {
	return (
		<header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
			<div className="max-w-5xl mx-auto px-4 py-4">
				<div className="flex items-center justify-between">
					<Link href="/" className="flex items-center gap-2 group">
						<div className="p-1.5 rounded bg-primary/10 border border-primary/30 group-hover:bg-primary/20 transition-colors">
							<Terminal className="h-4 w-4 text-primary" />
						</div>
						<span className="font-semibold text-foreground">awesome-ai</span>
					</Link>
					<nav className="flex items-center gap-1">
						<Button variant="ghost" size="sm" asChild>
							<Link href="/">agents</Link>
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<a
								href="https://github.com"
								target="_blank"
								rel="noopener noreferrer"
							>
								github
							</a>
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<a
								href="https://vercel.com/docs"
								target="_blank"
								rel="noopener noreferrer"
							>
								docs
							</a>
						</Button>
					</nav>
				</div>
			</div>
		</header>
	)
}
