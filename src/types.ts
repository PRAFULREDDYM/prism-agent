export type MessageRole = "system" | "user" | "assistant" | "tool" | "summary";

export interface Domain {
  id: string;
  score: number;
  label?: string;
  related?: string[];
  relatedIds?: string[];
  relationships?: string[];
  reason?: string;
}

export interface RouteAnalysis {
  intent: string;
  activeDomains: Domain[];
  fragment: string;
  tokensIn: number;
  saved: number;
  fillerRemoved: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface ToolCall {
  tool: string;
  params: Record<string, string>;
  raw: string;
}

export interface ToolExecutionResult {
  call: ToolCall;
  result: string;
}

export interface AgentTurnResult {
  response: string;
  route: RouteAnalysis;
  toolExecutions: ToolExecutionResult[];
  rawResponse: string;
}

export interface SessionStats {
  totalTokensIn: number;
  totalTokensSaved: number;
  fillerRemoved: number;
  turnsCount: number;
}

export interface PersistedSession {
  id: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  stats: SessionStats;
}
