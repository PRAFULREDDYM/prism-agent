import React, { createContext, useContext } from "react";

type AnyComponent = React.ComponentType<Record<string, unknown>>;

export interface InkRuntime {
  Box: AnyComponent;
  Text: AnyComponent;
  Spinner: AnyComponent;
  TextInput: AnyComponent;
  render: (tree: React.ReactElement) => {
    rerender: (tree: React.ReactElement) => void;
    unmount: () => void;
    waitUntilExit: () => Promise<unknown>;
  };
  useApp: () => {
    exit: (value?: unknown) => void;
  };
  useInput: (
    handler: (input: string, key: Record<string, boolean | string | undefined>) => void,
    options?: {
      isActive?: boolean;
    }
  ) => void;
  useStdout: () => {
    stdout: NodeJS.WriteStream;
    write: (data: string) => void;
  };
}

const InkRuntimeContext = createContext<InkRuntime | null>(null);

const nativeImport = new Function("specifier", "return import(specifier)") as <T>(specifier: string) => Promise<T>;

export const loadInkRuntime = async (): Promise<InkRuntime> => {
  const [inkModule, textInputModule, spinnerModule] = await Promise.all([
    nativeImport<Record<string, unknown>>("ink"),
    nativeImport<Record<string, unknown>>("ink-text-input"),
    nativeImport<Record<string, unknown>>("ink-spinner")
  ]);

  return {
    Box: inkModule.Box as AnyComponent,
    Text: inkModule.Text as AnyComponent,
    Spinner: spinnerModule.default as AnyComponent,
    TextInput: textInputModule.default as AnyComponent,
    render: inkModule.render as InkRuntime["render"],
    useApp: inkModule.useApp as InkRuntime["useApp"],
    useInput: inkModule.useInput as InkRuntime["useInput"],
    useStdout: inkModule.useStdout as InkRuntime["useStdout"]
  };
};

export const InkRuntimeProvider: React.FC<{
  runtime: InkRuntime;
  children: React.ReactNode;
}> = ({ runtime, children }) => <InkRuntimeContext.Provider value={runtime}>{children}</InkRuntimeContext.Provider>;

export const useInkRuntime = (): InkRuntime => {
  const runtime = useContext(InkRuntimeContext);
  if (!runtime) {
    throw new Error("Ink runtime is unavailable. Wrap the app with InkRuntimeProvider.");
  }

  return runtime;
};
