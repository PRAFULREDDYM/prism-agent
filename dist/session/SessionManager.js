"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const MAX_CONTEXT_TOKENS = 80000;
const SUMMARY_BATCH_SIZE = 20;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const estimateTokens = (value) => Math.max(1, Math.ceil(value.length / 4));
const defaultStats = () => ({
    totalTokensIn: 0,
    totalTokensSaved: 0,
    fillerRemoved: 0,
    turnsCount: 0
});
const createSessionId = () => `session-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const nowIso = () => new Date().toISOString();
const buildSummaryFallback = (messages) => {
    const snippets = messages.map((message) => `${message.role}: ${message.content.replace(/\s+/g, " ").slice(0, 160)}`);
    return `Summary of earlier conversation:\n${snippets.join("\n")}`;
};
class SessionManager {
    constructor(options = {}) {
        this.messages = [];
        this.stats = defaultStats();
        this.cwd = (0, path_1.resolve)(options.cwd ?? process.cwd());
        this.sessionId = options.sessionId ?? createSessionId();
        this.sessionRoot = options.sessionRoot ?? (0, path_1.join)((0, os_1.homedir)(), ".prism-agent", "sessions");
        this.sessionFile = (0, path_1.join)(this.sessionRoot, `${this.sessionId}.json`);
        this.createdAt = nowIso();
        this.updatedAt = this.createdAt;
        this.prism = options.prismClient;
    }
    async initialize() {
        await fs_1.promises.mkdir(this.sessionRoot, { recursive: true });
    }
    getMessages() {
        return [...this.messages];
    }
    async commitTurn(messages, route) {
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
    async appendMessages(messages) {
        this.messages.push(...messages);
        await this.enforceBudget();
        await this.persist();
    }
    async loadSession(sessionId) {
        const sessionFile = (0, path_1.join)(this.sessionRoot, `${sessionId}.json`);
        const raw = await fs_1.promises.readFile(sessionFile, "utf8");
        const parsed = JSON.parse(raw);
        this.messages = parsed.messages ?? [];
        this.stats = parsed.stats ?? defaultStats();
        this.createdAt = parsed.createdAt;
        this.updatedAt = parsed.updatedAt;
        return parsed;
    }
    async listRecentSessions(limit = 10) {
        await this.initialize();
        const entries = await fs_1.promises.readdir(this.sessionRoot, { withFileTypes: true });
        const sessions = [];
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }
            const raw = await fs_1.promises.readFile((0, path_1.join)(this.sessionRoot, entry.name), "utf8");
            sessions.push(JSON.parse(raw));
        }
        return sessions
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .slice(0, limit);
    }
    async getRecentResumeCandidate() {
        const [latestSession] = await this.listRecentSessions(1);
        if (!latestSession) {
            return null;
        }
        const age = Date.now() - new Date(latestSession.updatedAt).getTime();
        return age <= DAY_IN_MS ? latestSession : null;
    }
    async persist() {
        await this.initialize();
        this.updatedAt = nowIso();
        const payload = {
            id: this.sessionId,
            cwd: this.cwd,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            messages: this.messages,
            stats: this.stats
        };
        await fs_1.promises.writeFile(this.sessionFile, JSON.stringify(payload, null, 2), "utf8");
    }
    async enforceBudget() {
        while (this.totalMessageTokens() > MAX_CONTEXT_TOKENS && this.messages.length > SUMMARY_BATCH_SIZE) {
            const oldMessages = this.messages.slice(0, SUMMARY_BATCH_SIZE);
            const summaryContent = await this.summarizeMessages(oldMessages);
            const summaryMessage = {
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
    totalMessageTokens() {
        return this.messages.reduce((total, message) => total + estimateTokens(message.content), 0);
    }
    async summarizeMessages(messages) {
        const prompt = `Summarize this conversation history concisely for an AI coding assistant:\n${JSON.stringify(messages)}`;
        if (!this.prism) {
            return buildSummaryFallback(messages);
        }
        try {
            const response = await this.prism.send(prompt, {
                maxTokens: 1024
            });
            return response.text.trim() || buildSummaryFallback(messages);
        }
        catch {
            return buildSummaryFallback(messages);
        }
    }
}
exports.SessionManager = SessionManager;
exports.default = SessionManager;
