import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="text-primary">#</span>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
              <span className="text-primary">##</span>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-foreground mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-muted-foreground mb-3 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-none space-y-1 mb-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-4 text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-muted-foreground flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-muted text-primary text-sm">
                  {children}
                </code>
              );
            }
            return (
              <code className="block p-4 rounded bg-muted border border-border overflow-x-auto text-sm">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-4 rounded bg-muted border border-border overflow-x-auto">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <table className="w-full border-collapse mb-4 text-sm">
              {children}
            </table>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left py-2 px-3 text-foreground font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2 px-3 text-muted-foreground border-b border-border/50">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground mb-4">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
