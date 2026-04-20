import { exec as execCallback } from "child_process";
import { promises as fs } from "fs";
import { glob } from "glob";
import { dirname, isAbsolute, relative, resolve } from "path";
import { promisify } from "util";
import simpleGit, { SimpleGit } from "simple-git";
import { PrismClient } from "./PrismClient";
import { analyzePrompt } from "./routing";
import { AgentTurnResult, ChatMessage, Domain, RouteAnalysis, ToolCall, ToolExecutionResult } from "../types";

const exec = promisify(execCallback);

const MAX_CONTEXT_TOKENS = 500;
const MAX_TOOL_LOOPS = 8;
const MAX_OUTPUT_LENGTH = 12_000;

export interface AgentCoreOptions {
  cwd?: string;
  apiKey?: string;
  model?: string;
  prismClient?: PrismClient;
  confirmShell?: (command: string) => Promise<boolean>;
}

const nowIso = (): string => new Date().toISOString();

const createMessage = (role: ChatMessage["role"], content: string, meta?: ChatMessage["meta"]): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: nowIso(),
  meta
});

const truncate = (value: string, maxLength: number = MAX_OUTPUT_LENGTH): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}\n...<truncated>` : value;

const estimateTokens = (value: string): number => Math.max(1, Math.ceil(value.length / 4));

const stripToolCalls = (value: string): string =>
  value.replace(/<tool>[\s\S]*?(?=(?:<tool>|$))/g, "").trim();

const READ_ONLY_PREFIXES = [
  "cat",
  "find",
  "git branch",
  "git diff",
  "git log",
  "git rev-parse",
  "git show",
  "git status",
  "head",
  "ls",
  "node -v",
  "npm -v",
  "pwd",
  "rg",
  "sed",
  "tail",
  "wc",
  "which"
];

const WRITE_HINTS = [
  " >",
  ">>",
  "&&",
  "||",
  ";",
  "apply_patch",
  "cp ",
  "git add",
  "git checkout",
  "git commit",
  "git merge",
  "git rebase",
  "mkdir",
  "mv ",
  "npm install",
  "pnpm add",
  "rm ",
  "rmdir",
  "touch ",
  "yarn add"
];

const isReadOnlyShellCommand = (command: string): boolean => {
  const trimmed = command.trim().toLowerCase();

  if (!trimmed) {
    return false;
  }

  if (WRITE_HINTS.some((hint) => trimmed.includes(hint))) {
    return false;
  }

  return READ_ONLY_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix} `));
};

const normalizeToolParam = (tool: string, params: Record<string, string>): Record<string, string> => {
  if (tool === "writeFile" && !params.content) {
    return {
      ...params,
      content: params.text ?? params.body ?? ""
    };
  }

  return params;
};

const renderConversation = (messages: ChatMessage[]): string =>
  messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");

export class AgentCore {
  readonly cwd: string;

  private readonly git: SimpleGit;
  private readonly prism?: PrismClient;
  private readonly confirmShell?: (command: string) => Promise<boolean>;
  private running = false;
  private conversationId?: number;
  private messages: ChatMessage[] = [];
  private pinnedDomains = new Set<string>();
  private suppressedDomains = new Set<string>();

  constructor(options: AgentCoreOptions = {}) {
    this.cwd = resolve(options.cwd ?? process.cwd());
    this.git = simpleGit(this.cwd);
    this.prism = options.prismClient ?? (options.apiKey ? new PrismClient(options.apiKey, options.model) : undefined);
    this.confirmShell = options.confirmShell;
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  setMessages(messages: ChatMessage[]): void {
    this.messages = [...messages];
  }

  getPinnedDomains(): string[] {
    return Array.from(this.pinnedDomains);
  }

  getSuppressedDomains(): string[] {
    return Array.from(this.suppressedDomains);
  }

  pinDomain(id: string): void {
    this.pinnedDomains.add(id);
    this.suppressedDomains.delete(id);
  }

  suppressDomain(id: string): void {
    this.suppressedDomains.add(id);
    this.pinnedDomains.delete(id);
  }

  clearDomainOverrides(): void {
    this.pinnedDomains.clear();
    this.suppressedDomains.clear();
  }

  async readFile(path: string): Promise<string> {
    const filePath = this.resolvePath(path);
    return fs.readFile(filePath, "utf8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    const filePath = this.resolvePath(path);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  }

  async listFiles(pattern: string): Promise<string[]> {
    const matches = await glob(pattern || "**/*", {
      cwd: this.cwd,
      nodir: true,
      ignore: ["**/.git/**", "**/dist/**", "**/node_modules/**"]
    });

    return matches.sort();
  }

  async runShell(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const allowed = isReadOnlyShellCommand(command) || (await this.confirmShellExecution(command));

    if (!allowed) {
      return {
        stdout: "",
        stderr: "Command declined by user.",
        exitCode: 1
      };
    }

    try {
      const result = await exec(command, {
        cwd: this.cwd,
        maxBuffer: 2 * 1024 * 1024
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      };
    } catch (error) {
      const shellError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: shellError.stdout ?? "",
        stderr: shellError.stderr ?? shellError.message,
        exitCode: typeof shellError.code === "number" ? shellError.code : 1
      };
    }
  }

  async gitStatus(): Promise<string> {
    const status = await this.git.status();
    const branch = status.current || "detached";
    const files = status.files.length
      ? status.files.map((file) => `${file.working_dir}${file.index} ${file.path}`).join("\n")
      : "clean";

    return `branch: ${branch}\nahead: ${status.ahead}\nbehind: ${status.behind}\nfiles:\n${files}`;
  }

  async gitDiff(file?: string): Promise<string> {
    if (file) {
      return this.git.diff(["--", file]);
    }

    return this.git.diff();
  }

  async gitCommit(message: string): Promise<void> {
    await this.git.add(".");
    await this.git.commit(message);
  }

  async send(message: string): Promise<AgentTurnResult> {
    if (!this.running) {
      this.start();
    }

    if (!this.prism) {
      throw new Error("Prism client is not configured. Set ANTHROPIC_API_KEY or PRISM_API_KEY before starting the agent.");
    }

    const route = this.analyze(message);
    const codebaseContext = await this.buildCodebaseContext();
    const toolExecutions: ToolExecutionResult[] = [];
    let finalResponse = "";
    let lastRawResponse = "";

    this.messages.push(createMessage("user", message));

    for (let iteration = 0; iteration < MAX_TOOL_LOOPS; iteration += 1) {
      const prompt = this.buildPrompt({
        latestInput: iteration === 0 ? message : "Continue with the tool results below.",
        route,
        codebaseContext,
        includeCodebaseContext: iteration === 0
      });

      const prismResponse = await this.prism.send(prompt, {
        conversationId: this.conversationId,
        maxTokens: 4096
      });

      this.conversationId = prismResponse.conversationId ?? this.conversationId;
      lastRawResponse = prismResponse.text;

      const toolCalls = this.parseToolCalls(prismResponse.text);
      if (!toolCalls.length) {
        finalResponse = stripToolCalls(prismResponse.text) || prismResponse.text.trim();
        this.messages.push(createMessage("assistant", finalResponse, { route }));
        return {
          response: finalResponse,
          route,
          toolExecutions,
          rawResponse: lastRawResponse
        };
      }

      this.messages.push(createMessage("assistant", prismResponse.text, { toolCallCount: toolCalls.length, hidden: true }));

      const executionResults = await this.executeToolCalls(toolCalls);
      toolExecutions.push(...executionResults);
      this.messages.push(
        createMessage(
          "tool",
          executionResults
            .map(
              ({ call, result }) =>
                `Tool: ${call.tool}\nParameters: ${JSON.stringify(call.params, null, 2)}\nResult:\n${truncate(result)}`
            )
            .join("\n\n")
        )
      );
    }

    finalResponse = "I hit the maximum tool loop limit before reaching a final answer.";
    this.messages.push(createMessage("assistant", finalResponse));

    return {
      response: finalResponse,
      route,
      toolExecutions,
      rawResponse: lastRawResponse
    };
  }

  analyze(message: string): RouteAnalysis {
    return analyzePrompt(message, {
      pinnedDomains: this.getPinnedDomains(),
      suppressedDomains: this.getSuppressedDomains()
    });
  }

  private resolvePath(path: string): string {
    return isAbsolute(path) ? path : resolve(this.cwd, path);
  }

  private async buildCodebaseContext(): Promise<string> {
    const gitStatus = await this.gitStatus();
    const files = await this.listFiles("**/*");
    const tree = files
      .slice(0, 150)
      .map((filePath) => relative(this.cwd, resolve(this.cwd, filePath)))
      .join("\n");

    const sections = [
      `cwd: ${this.cwd}`,
      "git status:",
      gitStatus,
      "file tree:",
      tree || "(no files found)"
    ];

    const lines: string[] = [];
    let tokenCount = 0;

    for (const section of sections) {
      const sectionTokens = estimateTokens(`${section}\n`);
      if (tokenCount + sectionTokens > MAX_CONTEXT_TOKENS) {
        break;
      }

      tokenCount += sectionTokens;
      lines.push(section);
    }

    return lines.join("\n\n");
  }

  private buildPrompt({
    latestInput,
    route,
    codebaseContext,
    includeCodebaseContext
  }: {
    latestInput: string;
    route: RouteAnalysis;
    codebaseContext: string;
    includeCodebaseContext: boolean;
  }): string {
    const visibleDomains = route.activeDomains
      .filter((domain) => !this.suppressedDomains.has(domain.id))
      .map((domain) => `${domain.id}:${domain.score.toFixed(2)}`)
      .join(", ");

    return [
      "You are Prism Agent, a Claude Code-style AI coding assistant.",
      "When you need a tool, emit XML blocks only for the tool call you want to make.",
      "Available tools:",
      "readFile -> <tool>readFile</tool><path>relative/or/absolute/path</path>",
      "writeFile -> <tool>writeFile</tool><path>file</path><content>new text</content>",
      "listFiles -> <tool>listFiles</tool><pattern>glob pattern</pattern>",
      "runShell -> <tool>runShell</tool><command>command text</command>",
      "gitStatus -> <tool>gitStatus</tool>",
      "gitDiff -> <tool>gitDiff</tool><file>optional file path</file>",
      "gitCommit -> <tool>gitCommit</tool><message>commit message</message>",
      "If you do not need a tool, answer normally without XML.",
      `Intent: ${route.intent}`,
      `Domains: ${visibleDomains || "general"}`,
      `Latest route fragment: ${route.fragment}`,
      includeCodebaseContext ? `Codebase context:\n${codebaseContext}` : "",
      "Conversation so far:",
      renderConversation(this.messages),
      `Latest input:\n${latestInput}`
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private parseToolCalls(responseText: string): ToolCall[] {
    const matches = responseText.matchAll(/<tool>([\s\S]*?)<\/tool>([\s\S]*?)(?=(?:<tool>|$))/g);
    const toolCalls: ToolCall[] = [];

    for (const match of matches) {
      const tool = match[1].trim();
      const body = match[2] ?? "";
      const params: Record<string, string> = {};
      const paramMatches = body.matchAll(/<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g);

      for (const paramMatch of paramMatches) {
        params[paramMatch[1]] = paramMatch[2].trim();
      }

      toolCalls.push({
        tool,
        params: normalizeToolParam(tool, params),
        raw: match[0]
      });
    }

    return toolCalls;
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const call of toolCalls) {
      try {
        let result = "";

        switch (call.tool) {
          case "readFile":
            result = await this.readFile(call.params.path);
            break;
          case "writeFile":
            await this.writeFile(call.params.path, call.params.content ?? "");
            result = `Wrote ${call.params.path}`;
            break;
          case "listFiles":
            result = JSON.stringify(await this.listFiles(call.params.pattern || "**/*"), null, 2);
            break;
          case "runShell": {
            const shellResult = await this.runShell(call.params.command);
            result = JSON.stringify(shellResult, null, 2);
            break;
          }
          case "gitStatus":
            result = await this.gitStatus();
            break;
          case "gitDiff":
            result = await this.gitDiff(call.params.file);
            break;
          case "gitCommit":
            await this.gitCommit(call.params.message);
            result = `Committed with message: ${call.params.message}`;
            break;
          default:
            result = `Unknown tool: ${call.tool}`;
            break;
        }

        results.push({
          call,
          result: truncate(result)
        });
      } catch (error) {
        results.push({
          call,
          result: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    return results;
  }

  private async confirmShellExecution(command: string): Promise<boolean> {
    if (this.confirmShell) {
      return this.confirmShell(command);
    }

    if (!process.stdin.isTTY) {
      return false;
    }

    process.stdout.write(`\nprism-agent wants to run:\n${command}\nAllow? [y/N] `);

    const stdin = process.stdin;
    stdin.resume();
    stdin.setEncoding("utf8");

    const previousRawMode = stdin.isRaw;
    if (typeof stdin.setRawMode === "function") {
      stdin.setRawMode(true);
    }

    return new Promise<boolean>((resolve) => {
      const cleanup = (approved: boolean) => {
        stdin.removeListener("data", onData);
        if (typeof stdin.setRawMode === "function") {
          stdin.setRawMode(Boolean(previousRawMode));
        }
        process.stdout.write("\n");
        resolve(approved);
      };

      const onData = (chunk: string) => {
        const input = chunk.toLowerCase();
        if (input === "y") {
          cleanup(true);
          return;
        }

        cleanup(false);
      };

      stdin.once("data", onData);
    });
  }
}

export default AgentCore;
