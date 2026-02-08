import { TriangleRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DeployButtonProps {
	agentSlug: string
	repository?: string
}

export function DeployButton({ agentSlug, repository }: DeployButtonProps) {
	const deployUrl = repository
		? `https://vercel.com/new/clone?repository-url=${encodeURIComponent(repository)}`
		: `https://vercel.com/new?template=awesome-ai-${agentSlug}`

	return (
		<Button asChild>
			<a href={deployUrl} target="_blank" rel="noopener noreferrer">
				<TriangleRight className="h-4 w-4 fill-current" />
				Deploy to Vercel
			</a>
		</Button>
	)
}
