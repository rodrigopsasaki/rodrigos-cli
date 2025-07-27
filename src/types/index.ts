export interface ExtensionOption {
  name: string;
  short?: string;
  type: "string" | "boolean" | "number";
  description?: string;
  suggestions?: string[];
  required?: boolean;
  default?: any;
}

export interface ExtensionConfig {
  description?: string;
  runner?: string;
  passContext?: boolean;
  options?: ExtensionOption[];
  suggestionsCommand?: string;
}

export interface Extension {
  command: string;
  scriptPath: string;
  config?: ExtensionConfig | undefined;
  scriptType: "js" | "ts" | "sh" | "py" | "rb" | "php";
}

export interface ExecutionContext {
  command: string;
  options: Record<string, any>;
  args: string[];
  env: Record<string, string>;
}

export interface Config {
  extensionsDir?: string; // Deprecated: use extensionsDirs instead
  extensionsDirs?: string[];
  defaultRunner?: string;
  enableLogging?: boolean;
  darkMode?: boolean | undefined;
}

export interface CompletionSuggestion {
  text: string;
  description?: string | undefined;
  type?: "command" | "option" | "argument";
}

export interface ExtensionConflict {
  command: string;
  primaryExtension: Extension;
  conflictingExtensions: Array<Extension & { sourceDir: string }>;
}

export interface ExtensionSource {
  extension: Extension;
  sourceDir: string;
  priority: number; // Lower number = higher priority (first in config)
}
