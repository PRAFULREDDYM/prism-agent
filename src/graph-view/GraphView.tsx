import React, { useEffect, useMemo, useState } from "react";
import { Domain } from "../types";
import { useInkRuntime } from "../ui/InkRuntime";

export interface GraphViewProps {
  activeDomains: Domain[];
  pinnedDomains: string[];
  suppressedDomains: string[];
  onPin: (id: string) => void;
  onSuppress: (id: string) => void;
  onClearAll?: () => void;
  isActive?: boolean;
}

const BAR_WIDTH = 10;

const normalizeLabel = (domain: Domain): string => domain.label ?? domain.id;

const buildScoreBar = (score: number): string => {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round(score * BAR_WIDTH)));
  return `${"\u2588".repeat(filled)}${"\u2591".repeat(BAR_WIDTH - filled)}`;
};

const colorForScore = (score: number): { color?: string; dimColor?: boolean } => {
  if (score > 0.8) {
    return { color: "green" };
  }

  if (score >= 0.6) {
    return { color: "yellow" };
  }

  return { dimColor: true };
};

const collectRelationshipLines = (domains: Domain[]): string[] => {
  const domainMap = new Map(domains.map((domain) => [domain.id, domain]));
  const seenEdges = new Set<string>();
  const lines: string[] = [];

  for (const domain of domains) {
    const relatedIds = domain.related ?? domain.relatedIds ?? domain.relationships ?? [];

    for (const relatedId of relatedIds) {
      if (!domainMap.has(relatedId)) {
        continue;
      }

      const edgeKey = [domain.id, relatedId].sort().join("::");
      if (seenEdges.has(edgeKey)) {
        continue;
      }

      seenEdges.add(edgeKey);
      lines.push(`${normalizeLabel(domain)} -- ${normalizeLabel(domainMap.get(relatedId) as Domain)}`);
    }
  }

  return lines;
};

export const GraphView: React.FC<GraphViewProps> = ({
  activeDomains,
  pinnedDomains,
  suppressedDomains,
  onPin,
  onSuppress,
  onClearAll,
  isActive = true
}) => {
  const { Box, Text, useInput } = useInkRuntime();
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (activeDomains.length === 0) {
      setFocusedIndex(0);
      return;
    }

    if (focusedIndex >= activeDomains.length) {
      setFocusedIndex(activeDomains.length - 1);
    }
  }, [activeDomains, focusedIndex]);

  const relationshipLines = useMemo(() => collectRelationshipLines(activeDomains), [activeDomains]);

  useInput(
    (input, key) => {
      if (!activeDomains.length) {
        if ((input === "c" || input === "C") && onClearAll) {
          onClearAll();
        }

        return;
      }

      if (key.upArrow) {
        setFocusedIndex((current) => (current <= 0 ? activeDomains.length - 1 : current - 1));
        return;
      }

      if (key.downArrow) {
        setFocusedIndex((current) => (current >= activeDomains.length - 1 ? 0 : current + 1));
        return;
      }

      if (input === "p" || input === "P") {
        onPin(activeDomains[focusedIndex].id);
        return;
      }

      if (input === "s" || input === "S") {
        onSuppress(activeDomains[focusedIndex].id);
        return;
      }

      if ((input === "c" || input === "C") && onClearAll) {
        onClearAll();
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>KNOWLEDGE GRAPH</Text>
      <Box marginTop={1} flexDirection="column">
        {activeDomains.length === 0 ? (
          <Text dimColor>No active domains yet.</Text>
        ) : (
          activeDomains.map((domain, index) => {
            const isPinned = pinnedDomains.includes(domain.id);
            const isSuppressed = suppressedDomains.includes(domain.id);
            const isFocused = index === focusedIndex;
            const color = colorForScore(domain.score);
            const label = normalizeLabel(domain).padEnd(12, " ");
            const scoreText = domain.score.toFixed(2);
            const prefix = isFocused ? ">" : " ";
            const suffix = [isPinned ? "[P]" : "", isSuppressed ? "[S]" : ""].filter(Boolean).join("  ");
            const textColor = isFocused ? "cyan" : color.color;

            return (
              <Text key={domain.id} color={textColor} dimColor={color.dimColor}>
                {prefix} ◆ {label} {buildScoreBar(domain.score)}  {scoreText}
                {suffix ? `  ${suffix}` : ""}
              </Text>
            );
          })
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {relationshipLines.length > 0 ? (
          relationshipLines.map((line) => (
            <Text key={line} dimColor>
              {line}
            </Text>
          ))
        ) : (
          <Text dimColor>No domain relationships yet.</Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>[P]in domain  [S]uppress  [C]lear all</Text>
      </Box>
    </Box>
  );
};

export default GraphView;
