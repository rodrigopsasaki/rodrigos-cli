import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import yaml from 'js-yaml';
import type { Config } from '../types/index.js';

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    // Follow XDG base directory spec
    const xdgConfigHome = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
    this.configPath = join(xdgConfigHome, 'rc', 'config.yaml');
    
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const defaultConfig: Config = {
      extensionsDir: join(process.cwd(), 'examples', 'extensions'), // Use examples for testing
      defaultRunner: 'node',
      enableLogging: true,
    };

    if (!existsSync(this.configPath)) {
      this.saveConfig(defaultConfig);
      return defaultConfig;
    }

    try {
      const configContent = readFileSync(this.configPath, 'utf8');
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
      writeFileSync(this.configPath, configContent, 'utf8');
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

  getExtensionsDir(): string {
    return this.config.extensionsDir || join(process.cwd(), 'examples', 'extensions');
  }

  getDefaultRunner(): string {
    return this.config.defaultRunner || 'node';
  }

  isLoggingEnabled(): boolean {
    return this.config.enableLogging ?? true;
  }
} 