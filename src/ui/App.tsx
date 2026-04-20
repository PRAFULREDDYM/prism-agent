import React, { startTransition, useMemo, useState } from "react";
import AgentCore from "../agent/AgentCore";
import { formatRouteSummary } from "../agent/routing";
import GraphView from "../graph-view/GraphView";
import SessionManager from "../session/SessionManager";
import { ChatMessage, RouteAnalysis, SessionStats } from "../types";
import { useInkRuntime } from "./InkRuntime";

type FocusPane = "conversation" | "graph";

export interface AppProps {
  agent: AgentCore;
  sessionManager: SessionManager;
  initialRoute?: RouteAnalysis;
  resumeNotice?: string;
}

const createLocalMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: new Date().toISOString()
});

const formatNumber = (value: number): string => value.toLocaleString();

const roleColor = (role: ChatMessage["role"]): string | undefined => {
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

const roleLabel = (role: ChatMessage["role"]): string => {
  switch (role) {
    case "user":
      return "you";
    case "assistant":
      return "agent";
    default:
      return role;
  }
};

const visibleMessages = (messages: ChatMessage[]): ChatMessage[] =>
  messages.filter((message) => !message.meta?.hidden);

export const App: React.FC<AppProps> = ({ agent, sessionManager, initialRoute, resumeNotice }) => {
  const { Box, Spinner, Text, TextInput, useApp, useInput, useStdout } = useInkRuntime();
  const { exit } = useApp();
  const { stdout, write } = useStdout();

  const sessionMessages = sessionManager.getMessages();
  const derivedInitialRoute = useMemo(() => {
    if (initialRoute) {
      return initialRoute;
    }

    const lastUserMessage = [...sessionMessages].reverse().find((message) => message.role === "user");
    return lastUserMessage ? agent.analyze(lastUserMessage.content) : null;
  }, [agent, initialRoute, sessionMessages]);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusPane, setFocusPane] = useState<FocusPane>("conversation");
  const [historyOffset, setHistoryOffset] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(sessionMessages);
  const [route, setRoute] = useState<RouteAnalysis | null>(derivedInitialRoute);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ ...sessionManager.stats });
  const [statusMessage, setStatusMessage] = useState<string | null>(resumeNotice ?? null);
  const [pinnedDomains, setPinnedDomains] = useState<string[]>(agent.getPinnedDomains());
  const [suppressedDomains, setSuppressedDomains] = useState<string[]>(agent.getSuppressedDomains());
  const [lastUserPrompt, setLastUserPrompt] = useState<string>(() => {
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

  const refreshRouteFromPrompt = (prompt: string) => {
    const nextRoute = prompt ? agent.analyze(prompt) : null;
    setRoute(nextRoute);
    setPinnedDomains(agent.getPinnedDomains());
    setSuppressedDomains(agent.getSuppressedDomains());
  };

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const optimisticHistory = [...messages, createLocalMessage("user", trimmed)];
    startTransition(() => {
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

      startTransition(() => {
        setMessages(nextMessages);
        setRoute(result.route);
        setSessionStats({ ...sessionManager.stats });
        setPinnedDomains(agent.getPinnedDomains());
        setSuppressedDomains(agent.getSuppressedDomains());
        setHistoryOffset(0);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      startTransition(() => {
        setStatusMessage(`Agent error: ${message}`);
        setMessages([...optimisticHistory, createLocalMessage("assistant", `Error: ${message}`)]);
      });
    } finally {
      startTransition(() => {
        setIsLoading(false);
      });
    }
  };

  const updateDomainOverrides = (mode: "pin" | "suppress" | "clear", domainId?: string) => {
    if (mode === "pin" && domainId) {
      agent.pinDomain(domainId);
    } else if (mode === "suppress" && domainId) {
      agent.suppressDomain(domainId);
    } else {
      agent.clearDomainOverrides();
    }

    refreshRouteFromPrompt(lastUserPrompt);
  };

  useInput(
    (input, key) => {
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
    },
    { isActive: true }
  );

  return (
    <Box flexDirection="column" height={terminalRows}>
      <Box borderStyle="round" flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">
            ◆ PRISM AGENT
          </Text>
          <Text dimColor>
            [Tab] switch pane  [PgUp/PgDn] scroll  [Ctrl+S] stats  [Ctrl+L] clear  [Ctrl+C] exit
          </Text>
        </Box>

        <Box flexGrow={1} marginTop={1}>
          <Box width="30%" flexDirection="column" paddingRight={1}>
            <GraphView
              activeDomains={graphDomains}
              pinnedDomains={pinnedDomains}
              suppressedDomains={suppressedDomains}
              onPin={(domainId) => updateDomainOverrides("pin", domainId)}
              onSuppress={(domainId) => updateDomainOverrides("suppress", domainId)}
              onClearAll={() => updateDomainOverrides("clear")}
              isActive={focusPane === "graph" && !isLoading}
            />

            <Box marginTop={1} flexDirection="column" paddingX={1}>
              <Text bold>session stats</Text>
              <Text dimColor>tokens saved: {formatNumber(sessionStats.totalTokensSaved)}</Text>
              <Text dimColor>filler removed: {formatNumber(sessionStats.fillerRemoved)}</Text>
              <Text dimColor>turns: {formatNumber(sessionStats.turnsCount)}</Text>
              <Text dimColor>pane focus: {focusPane}</Text>
            </Box>
          </Box>

          <Text dimColor>│</Text>

          <Box width="70%" flexDirection="column" paddingLeft={1} flexGrow={1}>
            <Text bold>CONVERSATION</Text>

            <Box flexDirection="column" flexGrow={1} marginTop={1}>
              {historyWindow.length === 0 ? (
                <Text dimColor>Start typing to begin a Prism Agent session.</Text>
              ) : (
                historyWindow.map((message) => (
                  <Box key={message.id} marginBottom={1} flexDirection="column">
                    <Text color={roleColor(message.role)}>{roleLabel(message.role)}:</Text>
                    <Text dimColor={message.role === "tool" || message.role === "summary"}>{message.content}</Text>
                  </Box>
                ))
              )}
            </Box>

            {route ? (
              <Text color="cyan">● {formatRouteSummary(route, suppressedDomains)}</Text>
            ) : (
              <Text dimColor>● waiting for first routed turn</Text>
            )}

            {showStats ? (
              <Box marginTop={1} flexDirection="column">
                <Text bold>SESSION DETAILS</Text>
                <Text dimColor>tokens in: {formatNumber(sessionStats.totalTokensIn)}</Text>
                <Text dimColor>tokens saved: {formatNumber(sessionStats.totalTokensSaved)}</Text>
                <Text dimColor>filler removed: {formatNumber(sessionStats.fillerRemoved)}</Text>
                <Text dimColor>turns: {formatNumber(sessionStats.turnsCount)}</Text>
                <Text dimColor>messages: {formatNumber(messages.length)}</Text>
                <Text dimColor>session id: {sessionManager.sessionId}</Text>
              </Box>
            ) : null}

            {statusMessage ? (
              <Text color="yellow">{statusMessage}</Text>
            ) : null}

            <Box marginTop={1} flexDirection="column">
              {isLoading ? (
                <Text color="cyan">
                  <Spinner type="dots" /> Prism is thinking...
                </Text>
              ) : null}
              <Box>
                <Text color="green">{"> "}</Text>
                <TextInput
                  value={inputValue}
                  onChange={(value: string) => setInputValue(value)}
                  onSubmit={handleSubmit}
                  focus={focusPane === "conversation" && !isLoading}
                  placeholder="Ask Prism Agent to inspect, edit, debug, or explain..."
                  showCursor
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default App;
