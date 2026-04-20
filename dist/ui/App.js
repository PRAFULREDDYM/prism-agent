"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const react_1 = __importStar(require("react"));
const routing_1 = require("../agent/routing");
const GraphView_1 = __importDefault(require("../graph-view/GraphView"));
const InkRuntime_1 = require("./InkRuntime");
const createLocalMessage = (role, content) => ({
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString()
});
const formatNumber = (value) => value.toLocaleString();
const roleColor = (role) => {
    switch (role) {
        case "user":
            return "cyan";
        case "assistant":
            return "green";
        case "tool":
            return "yellow";
        case "summary":
            return "magenta";
        default:
            return undefined;
    }
};
const roleLabel = (role) => {
    switch (role) {
        case "user":
            return "you";
        case "assistant":
            return "agent";
        default:
            return role;
    }
};
const visibleMessages = (messages) => messages.filter((message) => !message.meta?.hidden);
const App = ({ agent, sessionManager, initialRoute, resumeNotice }) => {
    const { Box, Spinner, Text, TextInput, useApp, useInput, useStdout } = (0, InkRuntime_1.useInkRuntime)();
    const { exit } = useApp();
    const { stdout, write } = useStdout();
    const sessionMessages = sessionManager.getMessages();
    const derivedInitialRoute = (0, react_1.useMemo)(() => {
        if (initialRoute) {
            return initialRoute;
        }
        const lastUserMessage = [...sessionMessages].reverse().find((message) => message.role === "user");
        return lastUserMessage ? agent.analyze(lastUserMessage.content) : null;
    }, [agent, initialRoute, sessionMessages]);
    const [inputValue, setInputValue] = (0, react_1.useState)("");
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [focusPane, setFocusPane] = (0, react_1.useState)("conversation");
    const [historyOffset, setHistoryOffset] = (0, react_1.useState)(0);
    const [showStats, setShowStats] = (0, react_1.useState)(false);
    const [messages, setMessages] = (0, react_1.useState)(sessionMessages);
    const [route, setRoute] = (0, react_1.useState)(derivedInitialRoute);
    const [sessionStats, setSessionStats] = (0, react_1.useState)({ ...sessionManager.stats });
    const [statusMessage, setStatusMessage] = (0, react_1.useState)(resumeNotice ?? null);
    const [pinnedDomains, setPinnedDomains] = (0, react_1.useState)(agent.getPinnedDomains());
    const [suppressedDomains, setSuppressedDomains] = (0, react_1.useState)(agent.getSuppressedDomains());
    const [lastUserPrompt, setLastUserPrompt] = (0, react_1.useState)(() => {
        const lastUser = [...sessionMessages].reverse().find((message) => message.role === "user");
        return lastUser?.content ?? "";
    });
    const history = visibleMessages(messages);
    const terminalRows = stdout.rows || 28;
    const historyWindowSize = Math.max(8, terminalRows - (showStats ? 17 : 13));
    const maxHistoryOffset = Math.max(0, history.length - historyWindowSize);
    const clampedOffset = Math.min(historyOffset, maxHistoryOffset);
    const historyEnd = Math.max(0, history.length - clampedOffset);
    const historyStart = Math.max(0, historyEnd - historyWindowSize);
    const historyWindow = history.slice(historyStart, historyEnd);
    const graphDomains = route?.activeDomains ?? [];
    const refreshRouteFromPrompt = (prompt) => {
        const nextRoute = prompt ? agent.analyze(prompt) : null;
        setRoute(nextRoute);
        setPinnedDomains(agent.getPinnedDomains());
        setSuppressedDomains(agent.getSuppressedDomains());
    };
    const handleSubmit = async (value) => {
        const trimmed = value.trim();
        if (!trimmed || isLoading) {
            return;
        }
        const optimisticHistory = [...messages, createLocalMessage("user", trimmed)];
        (0, react_1.startTransition)(() => {
            setMessages(optimisticHistory);
            setInputValue("");
            setIsLoading(true);
            setStatusMessage(null);
            setHistoryOffset(0);
            setLastUserPrompt(trimmed);
        });
        try {
            const result = await agent.send(trimmed);
            const nextMessages = agent.getMessages();
            await sessionManager.commitTurn(nextMessages, result.route);
            (0, react_1.startTransition)(() => {
                setMessages(nextMessages);
                setRoute(result.route);
                setSessionStats({ ...sessionManager.stats });
                setPinnedDomains(agent.getPinnedDomains());
                setSuppressedDomains(agent.getSuppressedDomains());
                setHistoryOffset(0);
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            (0, react_1.startTransition)(() => {
                setStatusMessage(`Agent error: ${message}`);
                setMessages([...optimisticHistory, createLocalMessage("assistant", `Error: ${message}`)]);
            });
        }
        finally {
            (0, react_1.startTransition)(() => {
                setIsLoading(false);
            });
        }
    };
    const updateDomainOverrides = (mode, domainId) => {
        if (mode === "pin" && domainId) {
            agent.pinDomain(domainId);
        }
        else if (mode === "suppress" && domainId) {
            agent.suppressDomain(domainId);
        }
        else {
            agent.clearDomainOverrides();
        }
        refreshRouteFromPrompt(lastUserPrompt);
    };
    useInput((input, key) => {
        if (key.ctrl && input === "c") {
            exit();
            return;
        }
        if (key.ctrl && input === "l") {
            write("\u001bc");
            setHistoryOffset(0);
            return;
        }
        if (key.ctrl && input === "s") {
            setShowStats((current) => !current);
            return;
        }
        if (key.tab) {
            setFocusPane((current) => (current === "conversation" ? "graph" : "conversation"));
            return;
        }
        if (focusPane === "conversation" && !isLoading) {
            if (key.pageUp) {
                setHistoryOffset((current) => Math.min(current + 4, maxHistoryOffset));
                return;
            }
            if (key.pageDown) {
                setHistoryOffset((current) => Math.max(current - 4, 0));
            }
        }
    }, { isActive: true });
    return (react_1.default.createElement(Box, { flexDirection: "column", height: terminalRows },
        react_1.default.createElement(Box, { borderStyle: "round", flexDirection: "column", flexGrow: 1, paddingX: 1 },
            react_1.default.createElement(Box, { justifyContent: "space-between" },
                react_1.default.createElement(Text, { bold: true, color: "cyan" }, "\u25C6 PRISM AGENT"),
                react_1.default.createElement(Text, { dimColor: true }, "[Tab] switch pane  [PgUp/PgDn] scroll  [Ctrl+S] stats  [Ctrl+L] clear  [Ctrl+C] exit")),
            react_1.default.createElement(Box, { flexGrow: 1, marginTop: 1 },
                react_1.default.createElement(Box, { width: "30%", flexDirection: "column", paddingRight: 1 },
                    react_1.default.createElement(GraphView_1.default, { activeDomains: graphDomains, pinnedDomains: pinnedDomains, suppressedDomains: suppressedDomains, onPin: (domainId) => updateDomainOverrides("pin", domainId), onSuppress: (domainId) => updateDomainOverrides("suppress", domainId), onClearAll: () => updateDomainOverrides("clear"), isActive: focusPane === "graph" && !isLoading }),
                    react_1.default.createElement(Box, { marginTop: 1, flexDirection: "column", paddingX: 1 },
                        react_1.default.createElement(Text, { bold: true }, "session stats"),
                        react_1.default.createElement(Text, { dimColor: true },
                            "tokens saved: ",
                            formatNumber(sessionStats.totalTokensSaved)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "filler removed: ",
                            formatNumber(sessionStats.fillerRemoved)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "turns: ",
                            formatNumber(sessionStats.turnsCount)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "pane focus: ",
                            focusPane))),
                react_1.default.createElement(Text, { dimColor: true }, "\u2502"),
                react_1.default.createElement(Box, { width: "70%", flexDirection: "column", paddingLeft: 1, flexGrow: 1 },
                    react_1.default.createElement(Text, { bold: true }, "CONVERSATION"),
                    react_1.default.createElement(Box, { flexDirection: "column", flexGrow: 1, marginTop: 1 }, historyWindow.length === 0 ? (react_1.default.createElement(Text, { dimColor: true }, "Start typing to begin a Prism Agent session.")) : (historyWindow.map((message) => (react_1.default.createElement(Box, { key: message.id, marginBottom: 1, flexDirection: "column" },
                        react_1.default.createElement(Text, { color: roleColor(message.role) },
                            roleLabel(message.role),
                            ":"),
                        react_1.default.createElement(Text, { dimColor: message.role === "tool" || message.role === "summary" }, message.content)))))),
                    route ? (react_1.default.createElement(Text, { color: "cyan" },
                        "\u25CF ",
                        (0, routing_1.formatRouteSummary)(route, suppressedDomains))) : (react_1.default.createElement(Text, { dimColor: true }, "\u25CF waiting for first routed turn")),
                    showStats ? (react_1.default.createElement(Box, { marginTop: 1, flexDirection: "column" },
                        react_1.default.createElement(Text, { bold: true }, "SESSION DETAILS"),
                        react_1.default.createElement(Text, { dimColor: true },
                            "tokens in: ",
                            formatNumber(sessionStats.totalTokensIn)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "tokens saved: ",
                            formatNumber(sessionStats.totalTokensSaved)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "filler removed: ",
                            formatNumber(sessionStats.fillerRemoved)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "turns: ",
                            formatNumber(sessionStats.turnsCount)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "messages: ",
                            formatNumber(messages.length)),
                        react_1.default.createElement(Text, { dimColor: true },
                            "session id: ",
                            sessionManager.sessionId))) : null,
                    statusMessage ? (react_1.default.createElement(Text, { color: "yellow" }, statusMessage)) : null,
                    react_1.default.createElement(Box, { marginTop: 1, flexDirection: "column" },
                        isLoading ? (react_1.default.createElement(Text, { color: "cyan" },
                            react_1.default.createElement(Spinner, { type: "dots" }),
                            " Prism is thinking...")) : null,
                        react_1.default.createElement(Box, null,
                            react_1.default.createElement(Text, { color: "green" }, "> "),
                            react_1.default.createElement(TextInput, { value: inputValue, onChange: (value) => setInputValue(value), onSubmit: handleSubmit, focus: focusPane === "conversation" && !isLoading, placeholder: "Ask Prism Agent to inspect, edit, debug, or explain...", showCursor: true }))))))));
};
exports.App = App;
exports.default = exports.App;
