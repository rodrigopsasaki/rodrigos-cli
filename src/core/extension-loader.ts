import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { spawn } from 'child_process';
import yaml from 'js-yaml';
import type { Extension, ExtensionConfig, ExecutionContext } from '../types/index.js';
import { ConfigManager } from './config-manager.js';

export class ExtensionLoader {
  private configManager: ConfigManager;
  private extensionsCache: Extension[] = [];
  private cacheValid = false;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async loadExtensions(): Promise<Extension[]> {
    if (this.cacheValid) {
      return this.extensionsCache;
    }

    const extensionsDir = this.configManager.getExtensionsDir();
    this.extensionsCache = await this.discoverExtensions(extensionsDir);
    this.cacheValid = true;

    return this.extensionsCache;
  }

  private async discoverExtensions(dir: string, baseCommand = ''): Promise<Extension[]> {
    const extensions: Extension[] = [];

    if (!existsSync(dir)) {
      return extensions;
    }

    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const itemPath = join(dir, item);
        const stat = statSync(itemPath);
        
        if (stat.isDirectory()) {
          // Recursively discover extensions in subdirectories
          const subCommand = baseCommand ? `${baseCommand} ${item}` : item;
          const subExtensions = await this.discoverExtensions(itemPath, subCommand);
          extensions.push(...subExtensions);
        } else if (this.isExecutableFile(item)) {
          // Found an executable file
          const command = baseCommand ? `${baseCommand} ${this.getCommandName(item)}` : this.getCommandName(item);
          const extension = await this.createExtension(command, itemPath);
          if (extension) {
            extensions.push(extension);
          }
        }
      }
    } catch (error) {
      if (this.configManager.isLoggingEnabled()) {
        console.warn(`Warning: Could not read directory ${dir}:`, error);
      }
    }

    return extensions;
  }

  private isExecutableFile(filename: string): boolean {
    const executableExtensions = ['.js', '.ts', '.sh', '.py', '.rb', '.php'];
    const ext = extname(filename);
    return executableExtensions.includes(ext);
  }

  private getCommandName(filename: string): string {
    return basename(filename, extname(filename));
  }

  private async createExtension(command: string, scriptPath: string): Promise<Extension | null> {
    try {
      const scriptType = this.getScriptType(scriptPath);
      const config = await this.loadSidecarConfig(scriptPath);
      
      return {
        command,
        scriptPath,
        config: config || undefined,
        scriptType,
      };
    } catch (error) {
      if (this.configManager.isLoggingEnabled()) {
        console.warn(`Warning: Could not load extension ${scriptPath}:`, error);
      }
      return null;
    }
  }

  private getScriptType(scriptPath: string): Extension['scriptType'] {
    const ext = extname(scriptPath);
    switch (ext) {
      case '.js':
        return 'js';
      case '.ts':
        return 'ts';
      case '.sh':
        return 'sh';
      case '.py':
        return 'py';
      case '.rb':
        return 'rb';
      case '.php':
        return 'php';
      default:
        return 'js';
    }
  }

  private async loadSidecarConfig(scriptPath: string): Promise<ExtensionConfig | undefined> {
    const yamlPath = scriptPath.replace(extname(scriptPath), '.yaml');
    const jsonPath = scriptPath.replace(extname(scriptPath), '.json');

    // Try YAML first, then JSON
    for (const configPath of [yamlPath, jsonPath]) {
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf8');
          if (configPath.endsWith('.yaml')) {
            return yaml.load(configContent) as ExtensionConfig;
          } else {
            return JSON.parse(configContent) as ExtensionConfig;
          }
        } catch (error) {
          if (this.configManager.isLoggingEnabled()) {
            console.warn(`Warning: Could not parse config file ${configPath}:`, error);
          }
        }
      }
    }

    return undefined;
  }

  async executeExtension(extension: Extension, options: Record<string, any>): Promise<void> {
    const context: ExecutionContext = {
      command: extension.command,
      options,
      args: process.argv.slice(2),
      env: this.buildEnvironment(extension, options),
    };

    const runner = extension.config?.runner || this.configManager.getDefaultRunner();
    
    return new Promise((resolve, reject) => {
      const args = this.buildExecutionArgs(extension, runner, context);
      const child = spawn(runner, args, {
        stdio: ['pipe', 'inherit', 'inherit'],
        env: { ...process.env, ...context.env },
      });

      // Pass context as JSON to stdin if passContext is enabled
      if (extension.config?.passContext) {
        child.stdin?.write(JSON.stringify(context));
        child.stdin?.end();
      }

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Extension exited with code ${code}`));
        }
      });

      child.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private buildEnvironment(extension: Extension, options: Record<string, any>): Record<string, string> {
    const env: Record<string, string> = {};

    // Add RC_ prefixed environment variables
    env['RC_COMMAND'] = extension.command;
    env['RC_SCRIPT_PATH'] = extension.scriptPath;
    env['RC_SCRIPT_TYPE'] = extension.scriptType;

    // Add options as environment variables
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) {
        env[`RC_${key.toUpperCase()}`] = String(value);
      }
    }

    return env;
  }

  private buildExecutionArgs(extension: Extension, runner: string, context: ExecutionContext): string[] {
    const args: string[] = [];

    switch (runner) {
      case 'node':
        args.push(extension.scriptPath);
        break;
      case 'tsx':
        args.push(extension.scriptPath);
        break;
      case 'bash':
      case 'sh':
        args.push(extension.scriptPath);
        break;
      case 'python3':
      case 'python':
        args.push(extension.scriptPath);
        break;
      case 'ruby':
        args.push(extension.scriptPath);
        break;
      case 'php':
        args.push(extension.scriptPath);
        break;
      default:
        // Try to run directly
        args.push(extension.scriptPath);
    }

    // Add remaining arguments
    args.push(...context.args);

    return args;
  }

  invalidateCache(): void {
    this.cacheValid = false;
  }
} 