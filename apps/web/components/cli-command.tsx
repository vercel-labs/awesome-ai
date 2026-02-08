"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CliCommandProps {
  command: string;
}

export function CliCommand({ command }: CliCommandProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-secondary rounded border border-border overflow-hidden">
      <div className="flex-1 px-4 py-3 flex items-center gap-2">
        <span className="text-primary">$</span>
        <code className="text-sm text-foreground">{command}</code>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="rounded-none border-l border-border h-full px-4"
        aria-label={copied ? "Copied" : "Copy command"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}
