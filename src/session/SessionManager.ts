import { promises as fs } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import { PrismClient } from "../agent/PrismClient";
import { ChatMessage, PersistedSession, RouteAnalysis, SessionStats } from "../types";

const MAX_CONTEXT_TOKENS = 80_000;
const SUMMARY_BATCH_SIZE = 20;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface SessionManagerOptions {
  cwd?: string;
  sessionId?: string;
  prismClient?: PrismClient;
  sessionRoot?: string;
}

const estimateTokens = (value: string): number => Math.max(1, Math.ceil(value.length / 4));

const defaultStats = (): SessionStats => ({
  totalTokensIn: 0,
  totalTokensSaved: 0,
  fillerRemoved: 0,
  turnsCount: 0
});

const createSessionId = (): string => `session-${new Date().toISOString().replace(/[:.]/g, "-")}`;

const nowIso = (): string => new Date().toISOString();

const buildSummaryFallback = (messages: ChatMessage[]): string => {
  const snippets = messages.map((message) => `${message.role}: ${message.content.replace(/\s+/g, " ").slice(0, 160)}`);
  return `Summary of earlier conversation:\n${snippets.join("\n")}`;
};

export class SessionManager {
  readonly cwd: string;
  readonly sessionId: string;
  readonly sessionRoot: string;
  readonly sessionFile: string;

  messages: ChatMessage[] = [];
  stats: SessionStats = defaultStats();
  createdAt: string;
  updatedAt: string;

  private readonly prism?: PrismClient;

  constructor(options: SessionManagerOptions = {}) {
    this.cwd = resolve(options.cwd ?? process.cwd());
    this.sessionId = options.sessionId ?? createSessionId();
    this.sessionRoot = options.sessionRoot ?? join(homedir(), ".prism-agent", "sessions");
    this.sessionFile = join(this.sessionRoot, `${this.sessionId}.json`);
    this.createdAt = nowIso();
    this.updatedAt = this.createdAt;
    this.prism = options.prismClient;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionRoot, { recursive: true });
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  async commitTurn(messages: ChatMessage[], route?: RouteAnalysis): Promise<void> {
    this.messages = [...messages];

    if (route) {
      this.stats.totalTokensIn += route.tokensIn;
      this.stats.totalTokensSaved += route.saved;
      this.stats.fillerRemoved += route.fillerRemoved;
      this.stats.turnsCount += 1;
    }

    await this.enforceBudget();
    await this.persist();
  }

  async appendMessages(messages: ChatMessage[]): Promise<void> {
    this.messages.push(...messages);
    await this.enforceBudget();
    await this.persist();
  }

  async loadSession(sessionId: string): Promise<PersistedSession> {
    const sessionFile = join(this.sessionRoot, `${sessionId}.json`);
    const raw = await fs.readFile(sessionFile, "utf8");
    const parsed = JSON.parse(raw) as PersistedSession;
    this.messages = parsed.messages ?? [];
    this.stats = parsed.stats ?? defaultStats();
    this.createdAt = parsed.createdAt;
    this.updatedAt = parsed.updatedAt;
    return parsed;
  }

  async listRecentSessions(limit: number = 10): Promise<PersistedSession[]> {
    await this.initialize();
    const entries = await fs.readdir(this.sessionRoot, { withFileTypes: true });
    const sessions: PersistedSession[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const raw = await fs.readFile(join(this.sessionRoot, entry.name), "utf8");
      sessions.push(JSON.parse(raw) as PersistedSession);
    }

    return sessions
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  }

  async getRecentResumeCandidate(): Promise<PersistedSession | null> {
    const [latestSession] = await this.listRecentSessions(1);
    if (!latestSession) {
      return null;
    }

    const age = Date.now() - new Date(latestSession.updatedAt).getTime();
    return age <= DAY_IN_MS ? latestSession : null;
  }

  private async persist(): Promise<void> {
    await this.initialize();
    this.updatedAt = nowIso();

    const payload: PersistedSession = {
      id: this.sessionId,
      cwd: this.cwd,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      messages: this.messages,
      stats: this.stats
    };

    await fs.writeFile(this.sessionFile, JSON.stringify(payload, null, 2), "utf8");
  }

  private async enforceBudget(): Promise<void> {
    while (this.totalMessageTokens() > MAX_CONTEXT_TOKENS && this.messages.length > SUMMARY_BATCH_SIZE) {
      const oldMessages = this.messages.slice(0, SUMMARY_BATCH_SIZE);
      const summaryContent = await this.summarizeMessages(oldMessages);
      const summaryMessage: ChatMessage = {
        id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "summary",
        content: summaryContent,
        createdAt: nowIso(),
        meta: {
          summarizedCount: oldMessages.length
        }
      };

      const oldTokens = oldMessages.reduce((total, message) => total + estimateTokens(message.content), 0);
      const newTokens = estimateTokens(summaryMessage.content);

      this.messages = [summaryMessage, ...this.messages.slice(SUMMARY_BATCH_SIZE)];
      this.stats.totalTokensSaved += Math.max(0, oldTokens - newTokens);
    }
  }

  private totalMessageTokens(): number {
    return this.messages.reduce((total, message) => total + estimateTokens(message.content), 0);
  }

  private async summarizeMessages(messages: ChatMessage[]): Promise<string> {
    const prompt = `Summarize this conversation history concisely for an AI coding assistant:\n${JSON.stringify(messages)}`;

    if (!this.prism) {
      return buildSummaryFallback(messages);
    }

    try {
      const response = await this.prism.send(prompt, {
        maxTokens: 1024
      });

      return response.text.trim() || buildSummaryFallback(messages);
    } catch {
      return buildSummaryFallback(messages);
    }
  }
}

export default SessionManager;
