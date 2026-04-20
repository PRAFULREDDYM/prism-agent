"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const promises_1 = require("readline/promises");
const process_1 = require("process");
const path_1 = require("path");
const commander_1 = require("commander");
const dotenv_1 = __importDefault(require("dotenv"));
const AgentCore_1 = __importDefault(require("../agent/AgentCore"));
const routing_1 = require("../agent/routing");
const PrismClient_1 = require("../agent/PrismClient");
const SessionManager_1 = __importDefault(require("../session/SessionManager"));
const App_1 = __importDefault(require("../ui/App"));
const InkRuntime_1 = require("../ui/InkRuntime");
const BANNER = "◆ PRISM AGENT";
const printBanner = () => {
    console.log(BANNER);
    console.log("The only AI coding agent that shows you exactly why it answered the way it did.");
    console.log("");
};
const resolveApiKey = () => process.env.ANTHROPIC_API_KEY ?? process.env.PRISM_API_KEY;
const ensureApiKey = () => {
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
const askYesNo = async (question, defaultYes = true) => {
    if (!process_1.stdin.isTTY || !process_1.stdout.isTTY) {
        return defaultYes;
    }
    const rl = (0, promises_1.createInterface)({ input: process_1.stdin, output: process_1.stdout });
    const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
    const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase();
    rl.close();
    if (!answer) {
        return defaultYes;
    }
    return answer === "y" || answer === "yes";
};
const createSessionManager = async (cwd, prismClient, sessionId) => {
    const sessionManager = new SessionManager_1.default({
        cwd,
        prismClient,
        sessionId
    });
    await sessionManager.initialize();
    return sessionManager;
};
const renderApp = async ({ agent, sessionManager, resumeNotice }) => {
    const runtime = await (0, InkRuntime_1.loadInkRuntime)();
    const app = runtime.render(react_1.default.createElement(InkRuntime_1.InkRuntimeProvider, {
        runtime,
        children: react_1.default.createElement(App_1.default, { agent, sessionManager, resumeNotice })
    }));
    await app.waitUntilExit();
};
const startSession = async (cwdOption) => {
    dotenv_1.default.config();
    const cwd = (0, path_1.resolve)(cwdOption ?? process.cwd());
    const apiKey = ensureApiKey();
    const prismClient = new PrismClient_1.PrismClient(apiKey);
    let sessionManager = await createSessionManager(cwd, prismClient);
    let resumeNotice;
    const candidate = await sessionManager.getRecentResumeCandidate();
    if (candidate && candidate.cwd === cwd) {
        const shouldResume = await askYesNo(`Resume recent session ${candidate.id}?`);
        if (shouldResume) {
            sessionManager = await createSessionManager(cwd, prismClient, candidate.id);
            await sessionManager.loadSession(candidate.id);
            resumeNotice = `Resumed session ${candidate.id} from ${candidate.updatedAt}.`;
        }
    }
    const agent = new AgentCore_1.default({
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
const resumeSession = async (sessionId) => {
    dotenv_1.default.config();
    const apiKey = ensureApiKey();
    const bootstrapManager = await createSessionManager(process.cwd(), new PrismClient_1.PrismClient(apiKey));
    const sessions = await bootstrapManager.listRecentSessions(200);
    const targetSession = sessions.find((session) => session.id === sessionId);
    if (!targetSession) {
        console.error(`Session not found: ${sessionId}`);
        process.exitCode = 1;
        return;
    }
    const cwd = (0, path_1.resolve)(targetSession.cwd);
    const prismClient = new PrismClient_1.PrismClient(apiKey);
    const sessionManager = await createSessionManager(cwd, prismClient, sessionId);
    await sessionManager.loadSession(sessionId);
    const agent = new AgentCore_1.default({
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
const listHistory = async () => {
    dotenv_1.default.config();
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
const dryRunTest = async (prompt) => {
    dotenv_1.default.config();
    const route = (0, routing_1.analyzePrompt)(prompt);
    printBanner();
    console.log(`intent: ${route.intent}`);
    console.log(`domains: ${route.activeDomains.map((domain) => `${domain.id}:${domain.score.toFixed(2)}`).join(", ")}`);
    console.log(`fragment: ${route.fragment}`);
    console.log(`tokens_in: ${route.tokensIn}`);
    console.log(`saved: ${route.saved}`);
    console.log(`filler: ${route.fillerRemoved}`);
    console.log("");
    console.log((0, routing_1.formatRouteSummary)(route));
};
const program = new commander_1.Command();
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
    .action(async (options) => {
    await startSession(options.cwd);
});
program
    .command("test")
    .description("Dry run a prompt and show intent and domains without calling the API.")
    .argument("<prompt>", "Prompt to analyze")
    .action(async (prompt) => {
    await dryRunTest(prompt);
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
    .action(async (id) => {
    await resumeSession(id);
});
const main = async () => {
    try {
        await program.parseAsync(process.argv);
    }
    catch (error) {
        if (error instanceof Error && error.message === "Missing API key") {
            return;
        }
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
};
void main();
