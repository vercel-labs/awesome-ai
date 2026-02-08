export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Chat {
  id: string;
  title: string;
  agentId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// Mock chat history for demo
export const mockChats: Chat[] = [
  {
    id: "1",
    title: "Review auth middleware",
    agentId: "1",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Can you review my auth middleware?",
        timestamp: new Date("2024-01-15T10:00:00"),
      },
      {
        id: "m2",
        role: "assistant",
        content: "I'd be happy to review your auth middleware. Please share the code and I'll analyze it for security best practices.",
        timestamp: new Date("2024-01-15T10:00:30"),
      },
    ],
    createdAt: new Date("2024-01-15T10:00:00"),
    updatedAt: new Date("2024-01-15T10:00:30"),
  },
  {
    id: "2",
    title: "SQL query optimization",
    agentId: "2",
    messages: [
      {
        id: "m3",
        role: "user",
        content: "Help me optimize this SQL query",
        timestamp: new Date("2024-01-14T14:00:00"),
      },
      {
        id: "m4",
        role: "assistant",
        content: "Sure! Please share the query and table schema. I'll analyze the execution plan and suggest optimizations.",
        timestamp: new Date("2024-01-14T14:00:45"),
      },
    ],
    createdAt: new Date("2024-01-14T14:00:00"),
    updatedAt: new Date("2024-01-14T14:00:45"),
  },
  {
    id: "3",
    title: "Blog post draft",
    agentId: "3",
    messages: [
      {
        id: "m5",
        role: "user",
        content: "Write a blog post about AI agents",
        timestamp: new Date("2024-01-13T09:00:00"),
      },
      {
        id: "m6",
        role: "assistant",
        content: "I'll create an engaging blog post about AI agents. What's your target audience and preferred tone?",
        timestamp: new Date("2024-01-13T09:01:00"),
      },
    ],
    createdAt: new Date("2024-01-13T09:00:00"),
    updatedAt: new Date("2024-01-13T09:01:00"),
  },
  {
    id: "4",
    title: "Kubernetes deployment",
    agentId: "4",
    messages: [
      {
        id: "m7",
        role: "user",
        content: "Set up a K8s deployment for my Node.js app",
        timestamp: new Date("2024-01-12T16:00:00"),
      },
      {
        id: "m8",
        role: "assistant",
        content: "I'll help you create the Kubernetes manifests. Let me generate a deployment, service, and ingress configuration.",
        timestamp: new Date("2024-01-12T16:01:00"),
      },
    ],
    createdAt: new Date("2024-01-12T16:00:00"),
    updatedAt: new Date("2024-01-12T16:01:00"),
  },
];

export function getChatsByAgent(agentId: string): Chat[] {
  return mockChats.filter((chat) => chat.agentId === agentId);
}

export function getChatById(chatId: string): Chat | undefined {
  return mockChats.find((chat) => chat.id === chatId);
}
