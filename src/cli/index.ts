import React from "react";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { resolve } from "path";
import { Command } from "commander";
import dotenv from "dotenv";
import AgentCore from "../agent/AgentCore";
import { analyzePrompt, formatRouteSummary, getAvailableDomains } from "../agent/routing";
import { PrismClient } from "../agent/PrismClient";
import SessionManager from "../session/SessionManager";
import App from "../ui/App";
import { InkRuntimeProvider, loadInkRuntime } from "../ui/InkRuntime";

const BANNER = "◆ PRISM AGENT";

const printBanner = (): void => {
  console.log(BANNER);
  console.log("The only AI coding agent that shows you exactly why it answered the way it did.");
  console.log("");
};

const resolveApiKey = (): string | undefined => process.env.ANTHROPIC_API_KEY ?? process.env.PRISM_API_KEY;

const ensureApiKey = (): string => {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error("Missing API key.");
    console.error("Set `ANTHROPIC_API_KEY` in a `.env` file or export it in your shell.");
    console.error("If you are using Prism directly, `PRISM_API_KEY` is also accepted.");
    process.exitCode = 1;
    throw new Error("Missing API key");
  }

  return apiKey;
};

const askYesNo = async (question: string, defaultYes: boolean = true): Promise<boolean> => {
  if (!input.isTTY || !output.isTTY) {
    return defaultYes;
  }

  const rl = createInterface({ input, output });
  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase();
  rl.close();

  if (!answer) {
    return defaultYes;
  }

  return answer === "y" || answer === "yes";
};

const createSessionManager = async (cwd: string, prismClient?: PrismClient, sessionId?: string): Promise<SessionManager> => {
  const sessionManager = new SessionManager({
    cwd,
    prismClient,
    sessionId
  });

  await sessionManager.initialize();
  return sessionManager;
};

const renderApp = async ({
  agent,
  sessionManager,
  resumeNotice
}: {
  agent: AgentCore;
  sessionManager: SessionManager;
  resumeNotice?: string;
}): Promise<void> => {
  const runtime = await loadInkRuntime();
  const app = runtime.render(
    React.createElement(
      InkRuntimeProvider,
      {
        runtime,
        children: React.createElement(App, { agent, sessionManager, resumeNotice })
      }
    )
  );

  await app.waitUntilExit();
};

const startSession = async (cwdOption?: string): Promise<void> => {
  dotenv.config();

  const cwd = resolve(cwdOption ?? process.cwd());
  const apiKey = ensureApiKey();
  const prismClient = new PrismClient(apiKey);
  let sessionManager = await createSessionManager(cwd, prismClient);
  let resumeNotice: string | undefined;

  const candidate = await sessionManager.getRecentResumeCandidate();
  if (candidate && candidate.cwd === cwd) {
    const shouldResume = await askYesNo(`Resume recent session ${candidate.id}?`);
    if (shouldResume) {
      sessionManager = await createSessionManager(cwd, prismClient, candidate.id);
      await sessionManager.loadSession(candidate.id);
      resumeNotice = `Resumed session ${candidate.id} from ${candidate.updatedAt}.`;
    }
  }

  const agent = new AgentCore({
    cwd,
    apiKey
  });

  agent.start();
  agent.setMessages(sessionManager.getMessages());

  printBanner();
  await renderApp({
    agent,
    sessionManager,
    resumeNotice
  });
};

const resumeSession = async (sessionId: string): Promise<void> => {
  dotenv.config();

  const apiKey = ensureApiKey();
  const bootstrapManager = await createSessionManager(process.cwd(), new PrismClient(apiKey));
  const sessions = await bootstrapManager.listRecentSessions(200);
  const targetSession = sessions.find((session) => session.id === sessionId);

  if (!targetSession) {
    console.error(`Session not found: ${sessionId}`);
    process.exitCode = 1;
    return;
  }

  const cwd = resolve(targetSession.cwd);
  const prismClient = new PrismClient(apiKey);
  const sessionManager = await createSessionManager(cwd, prismClient, sessionId);
  await sessionManager.loadSession(sessionId);

  const agent = new AgentCore({
    cwd,
    apiKey
  });

  agent.start();
  agent.setMessages(sessionManager.getMessages());

  printBanner();
  await renderApp({
    agent,
    sessionManager,
    resumeNotice: `Resumed session ${sessionId}.`
  });
};

const listHistory = async (): Promise<void> => {
  dotenv.config();

  const sessionManager = await createSessionManager(process.cwd());
  const sessions = await sessionManager.listRecentSessions(20);

  printBanner();

  if (!sessions.length) {
    console.log("No sessions found.");
    return;
  }

  for (const session of sessions) {
    console.log(`${session.id}`);
    console.log(`  updated: ${session.updatedAt}`);
    console.log(`  cwd: ${session.cwd}`);
    console.log(`  turns: ${session.stats.turnsCount}  saved: ${session.stats.totalTokensSaved}  filler: ${session.stats.fillerRemoved}`);
    console.log(`  messages: ${session.messages.length}`);
    console.log("");
  }
};

const dryRunTest = async (prompt: string): Promise<void> => {
  dotenv.config();

  const route = analyzePrompt(prompt);

  printBanner();
  console.log(`intent: ${route.intent}`);
  console.log(`domains: ${route.activeDomains.map((domain) => `${domain.id}:${domain.score.toFixed(2)}`).join(", ")}`);
  console.log(`fragment: ${route.fragment}`);
  console.log(`tokens_in: ${route.tokensIn}`);
  console.log(`saved: ${route.saved}`);
  console.log(`filler: ${route.fillerRemoved}`);
  console.log("");
  console.log(formatRouteSummary(route));
};

const listDomains = async (): Promise<void> => {
  dotenv.config();

  const domains = getAvailableDomains();

  printBanner();
  console.log("available domains:");

  for (const domain of domains) {
    console.log(`- ${domain.label}`);
    console.log(`  related: ${domain.related.join(", ")}`);
    console.log(`  keywords: ${domain.keywords.join(", ")}`);
  }
};

const program = new Command();

program
  .name("prism-agent")
  .description("Claude Code-style terminal coding agent with Prism routing and a live knowledge graph.")
  .action(async () => {
    await startSession();
  });

program
  .command("start")
  .description("Start the Prism Agent terminal UI.")
  .option("--cwd <path>", "Start in a specific repository")
  .action(async (options: { cwd?: string }) => {
    await startSession(options.cwd);
  });

program
  .command("test")
  .description("Dry run a prompt and show intent and domains without calling the API.")
  .argument("<prompt>", "Prompt to analyze")
  .action(async (prompt: string) => {
    await dryRunTest(prompt);
  });

program
  .command("domains")
  .description("List the routing domains available to Prism Agent.")
  .action(async () => {
    await listDomains();
  });

program
  .command("history")
  .description("List recent sessions with stats.")
  .action(async () => {
    await listHistory();
  });

program
  .command("resume")
  .description("Resume a specific session.")
  .argument("<id>", "Session id")
  .action(async (id: string) => {
    await resumeSession(id);
  });

const main = async (): Promise<void> => {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error && error.message === "Missing API key") {
      return;
    }

    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
};

void main();
