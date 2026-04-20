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
exports.useInkRuntime = exports.InkRuntimeProvider = exports.loadInkRuntime = void 0;
const react_1 = __importStar(require("react"));
const InkRuntimeContext = (0, react_1.createContext)(null);
const nativeImport = new Function("specifier", "return import(specifier)");
const loadInkRuntime = async () => {
    const [inkModule, textInputModule, spinnerModule] = await Promise.all([
        nativeImport("ink"),
        nativeImport("ink-text-input"),
        nativeImport("ink-spinner")
    ]);
    return {
        Box: inkModule.Box,
        Text: inkModule.Text,
        Spinner: spinnerModule.default,
        TextInput: textInputModule.default,
        render: inkModule.render,
        useApp: inkModule.useApp,
        useInput: inkModule.useInput,
        useStdout: inkModule.useStdout
    };
};
exports.loadInkRuntime = loadInkRuntime;
const InkRuntimeProvider = ({ runtime, children }) => react_1.default.createElement(InkRuntimeContext.Provider, { value: runtime }, children);
exports.InkRuntimeProvider = InkRuntimeProvider;
const useInkRuntime = () => {
    const runtime = (0, react_1.useContext)(InkRuntimeContext);
    if (!runtime) {
        throw new Error("Ink runtime is unavailable. Wrap the app with InkRuntimeProvider.");
    }
    return runtime;
};
exports.useInkRuntime = useInkRuntime;
