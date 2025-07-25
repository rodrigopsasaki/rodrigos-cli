#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync } from 'fs';
import { ExtensionLoader } from '../core/extension-loader.js';
import { ConfigManager } from '../core/config-manager.js';
import { DadJokeService } from '../utils/dad-joke-service.js';
import { CompletionService } from '../core/completion-service.js';
import { chalk } from '../utils/chalk.js';
import type { Extension } from '../types/index.js';

const program = new Command();

// Set up the main program
program
  .name('rc')
  .description('Rodrigo\'s CLI - A developer-first CLI framework that makes local commands feel native')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose/debug output')
  .option('--debug', 'Enable debug mode (same as --verbose)')
  .option('--setup', 'Create example extensions and configuration')
  .option('--config', 'Show detailed configuration information')
  .option('--joke', 'Show a dad joke');

// Initialize core services
const configManager = new ConfigManager();
const extensionLoader = new ExtensionLoader(configManager);
const dadJokeService = new DadJokeService();
const completionService = new CompletionService(extensionLoader);

// Handle completion requests before command parsing
if (process.argv.includes('--complete')) {
  const suggestions = await completionService.getSuggestions(process.argv.slice(2));
  console.log(JSON.stringify(suggestions));
  process.exit(0);
}

// Default action - show config info when no arguments provided
program.action(async (options) => {
  if (process.argv.length === 2) {
    console.log(chalk.cyan.bold('\n🤖 Rodrigo\'s CLI\n'));
    
    // Show current configuration
    const config = configManager.getConfig();
    const configPath = configManager.getConfigPath();
    
    console.log(chalk.yellow('📁 Configuration:'));
    console.log(chalk.gray(`   Config file: ${configPath}`));
    console.log(chalk.gray(`   Extensions dir: ${config.extensionsDir}`));
    console.log(chalk.gray(`   Default runner: ${config.defaultRunner}`));
    console.log(chalk.gray(`   Logging enabled: ${config.enableLogging}`));
    
    // Check if extensions directory exists and has extensions
    const extensionsDir = configManager.getExtensionsDir();
    const hasExtensions = await extensionLoader.loadExtensions().then(exts => exts.length > 0);
    
    console.log(chalk.yellow('\n📦 Extensions:'));
    if (hasExtensions) {
      console.log(chalk.green(`   ✅ Found extensions in: ${extensionsDir}`));
      console.log(chalk.gray('   Run "rc help" to see available commands'));
    } else {
      console.log(chalk.red(`   ❌ No extensions found in: ${extensionsDir}`));
      console.log(chalk.gray('   Run "rc --setup" to create example extensions'));
    }
    
    console.log(chalk.yellow('\n🚀 Quick Start:'));
    console.log(chalk.gray('   rc help              # Show available commands'));
    console.log(chalk.gray('   rc --setup           # Create example extensions'));
    console.log(chalk.gray('   rc --config          # Show detailed config info'));
    console.log(chalk.gray('   rc --joke            # Show a dad joke'));
    console.log('');
  } else {
    // Handle specific options
    if (options.setup) {
      await handleSetup();
    } else if (options.config) {
      await handleConfig();
    } else if (options.joke) {
      await handleJoke();
    }
  }
});

// Handler functions
async function handleSetup() {
  console.log(chalk.cyan.bold('\n🔧 Setting up Rodrigo\'s CLI...\n'));
  
  try {
    // Get user's home directory for extensions
    const { homedir } = await import('os');
    const { join } = await import('path');
    const { mkdirSync } = await import('fs');
    
    const userExtensionsDir = join(homedir(), '.dotfiles', 'rc', 'extensions');
    
    console.log(chalk.yellow('📁 Creating extensions directory...'));
    if (!existsSync(userExtensionsDir)) {
      mkdirSync(userExtensionsDir, { recursive: true });
      console.log(chalk.green(`   ✅ Created: ${userExtensionsDir}`));
    } else {
      console.log(chalk.gray(`   📁 Already exists: ${userExtensionsDir}`));
    }
    
    // Copy example extensions
    const exampleExtensionsDir = join(process.cwd(), 'examples', 'extensions');
    if (existsSync(exampleExtensionsDir)) {
      console.log(chalk.yellow('\n📦 Copying example extensions...'));
      await copyDirectory(exampleExtensionsDir, userExtensionsDir);
      console.log(chalk.green('   ✅ Example extensions copied'));
    }
    
    // Update config to use user's extensions directory
    console.log(chalk.yellow('\n⚙️  Updating configuration...'));
    configManager.updateConfig({ extensionsDir: userExtensionsDir });
    console.log(chalk.green('   ✅ Configuration updated'));
    
    console.log(chalk.green('\n🎉 Setup complete!'));
    console.log(chalk.gray('   Run "rc" to see your extensions'));
    console.log(chalk.gray('   Run "rc help" to see available commands'));
    console.log('');
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error);
    process.exit(1);
  }
}

async function handleConfig() {
  console.log(chalk.cyan.bold('\n⚙️  Configuration Details\n'));
  
  const config = configManager.getConfig();
  const configPath = configManager.getConfigPath();
  
  console.log(chalk.yellow('📁 Config File:'));
  console.log(chalk.gray(`   Path: ${configPath}`));
  console.log(chalk.gray(`   Exists: ${existsSync(configPath) ? 'Yes' : 'No'}`));
  
  console.log(chalk.yellow('\n🔧 Settings:'));
  console.log(chalk.gray(`   Extensions Directory: ${config.extensionsDir}`));
  console.log(chalk.gray(`   Default Runner: ${config.defaultRunner}`));
  console.log(chalk.gray(`   Logging Enabled: ${config.enableLogging}`));
  
  // Show extensions info
  const extensions = await extensionLoader.loadExtensions();
  console.log(chalk.yellow('\n📦 Extensions:'));
  console.log(chalk.gray(`   Found: ${extensions.length} extension(s)`));
  
  if (extensions.length > 0) {
    for (const ext of extensions) {
      console.log(chalk.gray(`   - ${ext.command} (${ext.scriptType})`));
    }
  }
  
  console.log('');
}

async function handleJoke() {
  console.log(chalk.cyan.bold('\n🎭 Dad Joke\n'));
  const joke = await dadJokeService.getRandomJoke();
  console.log(chalk.yellow(joke));
  console.log('');
}

// Helper function to copy directory recursively
async function copyDirectory(src: string, dest: string) {
  const { readdirSync, statSync, copyFileSync, mkdirSync } = await import('fs');
  const { join } = await import('path');
  
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const items = readdirSync(src);
  
  for (const item of items) {
    const srcPath = join(src, item);
    const destPath = join(dest, item);
    
    if (statSync(srcPath).isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// Load and register extensions
async function loadExtensions() {
  try {
    const extensions = await extensionLoader.loadExtensions();
    
    // Debug: Show loaded extensions
    if (process.argv.includes('--verbose') || process.argv.includes('--debug')) {
      console.log(chalk.blue('🔍 [DEBUG] Loaded extensions:'));
      for (const ext of extensions) {
        console.log(chalk.blue(`🔍 [DEBUG] - ${ext.command} -> ${ext.scriptPath}`));
      }
      console.log(chalk.blue('🔍 [DEBUG] ---'));
    }
    
    // Group extensions by their main command
    const commandGroups: Record<string, Extension[]> = {};
    for (const extension of extensions) {
      const parts = extension.command.split(' ');
      const mainCommand = parts[0];
      if (mainCommand) {
        if (!commandGroups[mainCommand]) {
          commandGroups[mainCommand] = [];
        }
        commandGroups[mainCommand].push(extension);
      }
    }
    
    // Register commands properly
    for (const [mainCommand, groupExtensions] of Object.entries(commandGroups)) {
      if (groupExtensions.length === 1) {
        // Single command, register directly
        const extension = groupExtensions[0];
        if (!extension) continue;
        
        const command = program.command(extension.command);
        
        if (extension.config?.description) {
          command.description(extension.config.description);
        }
        
        // Add options from sidecar config
        if (extension.config?.options) {
          for (const option of extension.config.options) {
            const optionStr = option.short 
              ? `-${option.short}, --${option.name} <${option.name}>`
              : `--${option.name} <${option.name}>`;
            
            command.option(optionStr, option.description);
          }
        }
        
        command.action(async (options) => {
          try {
            const isVerbose = process.argv.includes('--verbose') || process.argv.includes('--debug');
            
            if (isVerbose) {
              console.log(chalk.blue(`🔍 [DEBUG] Executing extension: ${extension.command}`));
              console.log(chalk.blue(`🔍 [DEBUG] Script path: ${extension.scriptPath}`));
              console.log(chalk.blue(`🔍 [DEBUG] Script type: ${extension.scriptType}`));
              console.log(chalk.blue(`🔍 [DEBUG] Runner: ${extension.config?.runner || 'default'}`));
              console.log(chalk.blue(`🔍 [DEBUG] Options: ${JSON.stringify(options, null, 2)}`));
              console.log(chalk.blue('🔍 [DEBUG] ---'));
            }
            
            await extensionLoader.executeExtension(extension, options, isVerbose);
          } catch (error) {
            console.error(chalk.red(`Error executing ${extension.command}:`), error);
            process.exit(1);
          }
        });
      } else {
        // Multiple commands with same prefix, create subcommands
        const mainCmd = program.command(mainCommand);
        
        for (const extension of groupExtensions) {
          if (!extension) continue;
          
          const parts = extension.command.split(' ');
          const subCommand = parts.slice(1).join(' ');
          
          const subCmd = mainCmd.command(subCommand);
          
          if (extension.config?.description) {
            subCmd.description(extension.config.description);
          }
          
          // Add options from sidecar config
          if (extension.config?.options) {
            for (const option of extension.config.options) {
              const optionStr = option.short 
                ? `-${option.short}, --${option.name} <${option.name}>`
                : `--${option.name} <${option.name}>`;
              
              subCmd.option(optionStr, option.description);
            }
          }
          
          subCmd.action(async (options) => {
            try {
              const isVerbose = process.argv.includes('--verbose') || process.argv.includes('--debug');
              
              if (isVerbose) {
                console.log(chalk.blue(`🔍 [DEBUG] Executing extension: ${extension.command}`));
                console.log(chalk.blue(`🔍 [DEBUG] Script path: ${extension.scriptPath}`));
                console.log(chalk.blue(`🔍 [DEBUG] Script type: ${extension.scriptType}`));
                console.log(chalk.blue(`🔍 [DEBUG] Runner: ${extension.config?.runner || 'default'}`));
                console.log(chalk.blue(`🔍 [DEBUG] Options: ${JSON.stringify(options, null, 2)}`));
                console.log(chalk.blue('🔍 [DEBUG] ---'));
              }
              
              await extensionLoader.executeExtension(extension, options, isVerbose);
            } catch (error) {
              console.error(chalk.red(`Error executing ${extension.command}:`), error);
              process.exit(1);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('Error loading extensions:'), error);
    process.exit(1);
  }
}

// Completion command
program
  .command('completion')
  .description('Generate shell completion script')
  .argument('<shell>', 'Shell type (bash, zsh, fish)')
  .action((shell) => {
    const completionScript = completionService.generateCompletionScript(shell);
    console.log(completionScript);
  });

// Help command with recursive listing
program
  .command('help')
  .description('Show detailed help with all available commands')
  .action(async () => {
    console.log(chalk.cyan.bold('\n📚 Available Commands\n'));
    
    const extensions = await extensionLoader.loadExtensions();
    const commandTree = buildCommandTree(extensions);
    printCommandTree(commandTree, 0);
  });

function buildCommandTree(extensions: any[]) {
  const tree: Record<string, any> = {};
  
  for (const ext of extensions) {
    const parts = ext.command.split(' ');
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { description: ext.config?.description, children: {} };
      }
      if (i === parts.length - 1) {
        current[part].extension = ext;
      }
      current = current[part].children;
    }
  }
  
  return tree;
}

function printCommandTree(tree: Record<string, any>, depth: number) {
  const indent = '  '.repeat(depth);
  
  for (const [command, info] of Object.entries(tree)) {
    const hasChildren = Object.keys(info.children).length > 0;
    const icon = hasChildren ? '📁' : '⚡';
    const desc = info.description ? chalk.gray(` - ${info.description}`) : '';
    
    console.log(`${indent}${icon} ${chalk.cyan(command)}${desc}`);
    
    if (hasChildren) {
      printCommandTree(info.children, depth + 1);
    }
  }
}

// Parse arguments and run
async function main() {
  await loadExtensions();
  await program.parseAsync();
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
}); 