import Link from "next/link";
import { ArrowRight, Download, Terminal } from "lucide-react";
import type { Agent } from "@/lib/agents";
import { Badge } from "@/components/ui/badge";

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group block p-4 rounded border border-border bg-card hover:border-primary/50 hover:bg-secondary/50 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
              {agent.name}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {agent.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {agent.downloads.toLocaleString()}
            </span>
            <Badge variant="secondary">{agent.category}</Badge>
            <span>v{agent.version}</span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
      </div>
    </Link>
  );
}
