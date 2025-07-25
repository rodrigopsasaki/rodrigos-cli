#!/usr/bin/env node

import { Command } from 'commander';
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
  .option('--debug', 'Enable debug mode (same as --verbose)');

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

// Default action - show dad joke when no arguments provided
program.action(async () => {
  if (process.argv.length === 2) {
    console.log(chalk.cyan.bold('\n🤖 Rodrigo\'s CLI\n'));
    const joke = await dadJokeService.getRandomJoke();
    console.log(chalk.yellow(joke));
    console.log(chalk.gray('\nRun "rc --help" to see available commands\n'));
  }
});

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