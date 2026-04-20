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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphView = void 0;
const react_1 = __importStar(require("react"));
const InkRuntime_1 = require("../ui/InkRuntime");
const BAR_WIDTH = 10;
const normalizeLabel = (domain) => domain.label ?? domain.id;
const buildScoreBar = (score) => {
    const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round(score * BAR_WIDTH)));
    return `${"\u2588".repeat(filled)}${"\u2591".repeat(BAR_WIDTH - filled)}`;
};
const colorForScore = (score) => {
    if (score > 0.8) {
        return { color: "green" };
    }
    if (score >= 0.6) {
        return { color: "yellow" };
    }
    return { dimColor: true };
};
const collectRelationshipLines = (domains) => {
    const domainMap = new Map(domains.map((domain) => [domain.id, domain]));
    const seenEdges = new Set();
    const lines = [];
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
            lines.push(`${normalizeLabel(domain)} -- ${normalizeLabel(domainMap.get(relatedId))}`);
        }
    }
    return lines;
};
const GraphView = ({ activeDomains, pinnedDomains, suppressedDomains, onPin, onSuppress, onClearAll, isActive = true }) => {
    const { Box, Text, useInput } = (0, InkRuntime_1.useInkRuntime)();
    const [focusedIndex, setFocusedIndex] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        if (activeDomains.length === 0) {
            setFocusedIndex(0);
            return;
        }
        if (focusedIndex >= activeDomains.length) {
            setFocusedIndex(activeDomains.length - 1);
        }
    }, [activeDomains, focusedIndex]);
    const relationshipLines = (0, react_1.useMemo)(() => collectRelationshipLines(activeDomains), [activeDomains]);
    useInput((input, key) => {
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
    }, { isActive });
    return (react_1.default.createElement(Box, { flexDirection: "column", paddingX: 1 },
        react_1.default.createElement(Text, { bold: true }, "KNOWLEDGE GRAPH"),
        react_1.default.createElement(Box, { marginTop: 1, flexDirection: "column" }, activeDomains.length === 0 ? (react_1.default.createElement(Text, { dimColor: true }, "No active domains yet.")) : (activeDomains.map((domain, index) => {
            const isPinned = pinnedDomains.includes(domain.id);
            const isSuppressed = suppressedDomains.includes(domain.id);
            const isFocused = index === focusedIndex;
            const color = colorForScore(domain.score);
            const label = normalizeLabel(domain).padEnd(12, " ");
            const scoreText = domain.score.toFixed(2);
            const prefix = isFocused ? ">" : " ";
            const suffix = [isPinned ? "[P]" : "", isSuppressed ? "[S]" : ""].filter(Boolean).join("  ");
            const textColor = isFocused ? "cyan" : color.color;
            return (react_1.default.createElement(Text, { key: domain.id, color: textColor, dimColor: color.dimColor },
                prefix,
                " \u25C6 ",
                label,
                " ",
                buildScoreBar(domain.score),
                "  ",
                scoreText,
                suffix ? `  ${suffix}` : ""));
        }))),
        react_1.default.createElement(Box, { marginTop: 1, flexDirection: "column" }, relationshipLines.length > 0 ? (relationshipLines.map((line) => (react_1.default.createElement(Text, { key: line, dimColor: true }, line)))) : (react_1.default.createElement(Text, { dimColor: true }, "No domain relationships yet."))),
        react_1.default.createElement(Box, { marginTop: 1, flexDirection: "column" },
            react_1.default.createElement(Text, { dimColor: true }, "[P]in domain  [S]uppress  [C]lear all"))));
};
exports.GraphView = GraphView;
exports.default = exports.GraphView;
