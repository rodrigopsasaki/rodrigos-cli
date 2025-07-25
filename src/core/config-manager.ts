import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import yaml from "js-yaml";
import type { Config } from "../types/index.js";

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    // Follow XDG base directory spec
    const xdgConfigHome = process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config");
    this.configPath = join(xdgConfigHome, "rc", "config.yaml");

    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const defaultConfig: Config = {
      extensionsDir: join(homedir(), ".rc", "extensions"),
      defaultRunner: "node",
      enableLogging: true,
      darkMode: undefined, // undefined means auto-detect
    };

    if (!existsSync(this.configPath)) {
      // Don't create config file automatically - return default config only
      return defaultConfig;
    }

    try {
      const configContent = readFileSync(this.configPath, "utf8");
      const userConfig = yaml.load(configContent) as Partial<Config>;

      return { ...defaultConfig, ...userConfig };
    } catch (error) {
      console.warn(`Warning: Could not load config from ${this.configPath}:`, error);
      return defaultConfig;
    }
  }

  private saveConfig(config: Config): void {
    try {
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      const configContent = yaml.dump(config);
      writeFileSync(this.configPath, configContent, "utf8");
    } catch (error) {
      console.warn(`Warning: Could not save config to ${this.configPath}:`, error);
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }

  getConfig(): Config {
    return { ...this.config };
  }

  updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  createComprehensiveConfig(extensionsDir: string): void {
    const comprehensiveConfigContent = `# Rodrigo's CLI Configuration
# This file contains all available configuration options for rc
# Edit this file to customize rc's behavior

# Directory where your extensions are stored
# This is where rc will look for your custom commands
# You can change this to any directory you prefer
extensionsDir: ${extensionsDir}

# Default script runner for extensions
# Options: "node", "python", "ruby", "php", "bash", "sh"
# This is used when an extension doesn't specify its own runner
# Change this based on your preferred scripting language
defaultRunner: node

# Enable or disable debug logging
# When true, rc will show detailed information about extension execution
# Useful for debugging extension issues
# Set to false to reduce output verbosity
enableLogging: true

# Theme mode for terminal output
# Options: true (force dark), false (force light), null (auto-detect)
# When null, rc will try to detect your terminal theme automatically
# Set to true if you're using a dark terminal and want consistent colors
# Set to false if you're using a light terminal and want consistent colors
darkMode: null

# Example extension configuration (for reference):
# This shows how you can configure individual extensions
# Create a file named after your extension (e.g., "my-command.yaml") in your extensions directory
#
# description: "A helpful description of what this command does"
# runner: "node"  # Override the default runner for this specific extension
# passContext: true  # Pass execution context to the extension
# options:
#   - name: "output"
#     short: "o"
#     type: "string"
#     description: "Output format"
#     suggestions: ["json", "yaml", "text"]
#     required: false
#     default: "text"
#   - name: "verbose"
#     type: "boolean"
#     description: "Enable verbose output"
#     required: false
#     default: false
`;

    try {
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      writeFileSync(this.configPath, comprehensiveConfigContent, "utf8");
      
      // Update the in-memory config
      this.config = {
        extensionsDir,
        defaultRunner: "node",
        enableLogging: true,
        darkMode: undefined
      };
    } catch (error) {
      console.warn(`Warning: Could not save comprehensive config to ${this.configPath}:`, error);
    }
  }

  getExtensionsDir(): string {
    return this.config.extensionsDir || join(process.cwd(), "examples", "extensions");
  }

  getDefaultRunner(): string {
    return this.config.defaultRunner || "node";
  }

  isLoggingEnabled(): boolean {
    return this.config.enableLogging ?? true;
  }

  isDarkMode(): boolean | undefined {
    return this.config.darkMode;
  }
}
