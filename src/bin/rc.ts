#!/usr/bin/env node

import { Command } from "commander";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { ExtensionLoader } from "../core/extension-loader.js";
import { ConfigManager } from "../core/config-manager.js";
import { DadJokeService } from "../utils/dad-joke-service.js";
import { CompletionService } from "../core/completion-service.js";
import { themeChalk } from "../utils/chalk.js";
import { ui } from "../utils/ui.js";
import { withProgress, executeWithProgress } from "../utils/progress.js";
import { setupWizard } from "../utils/wizard.js";
import type { Extension } from "../types/index.js";
import { basename } from "path";

// Detect if we're being called via an alias
const binaryName = basename(process.argv[1] || '');
const isAliased = binaryName !== 'rc' && binaryName !== 'rc.js' && binaryName !== 'rc-immutable' && binaryName !== 'rc-immutable.js';
const aliasCommand = isAliased ? binaryName : null;

const program = new Command();

// Handle aliased execution before normal command processing
if (aliasCommand) {
  await handleAliasedExecution(aliasCommand);
}

// Set up the main program
program
  .name("rc")
  .description("Rodrigo's CLI - A developer-first CLI framework that makes local commands feel native")
  .version("1.0.0")
  .option("-v, --verbose", "Enable verbose/debug output")
  .option("--debug", "Enable debug mode (same as --verbose)")
  .option("--setup", "Create example extensions and configuration")
  .option("--config", "Show detailed configuration information")
  .option("--joke", "Show a dad joke")
  .option("--migrate", "Show XDG directory structure and benefits")
  .option("--update", "Update to the latest version");

// Initialize core services
const configManager = new ConfigManager();
const extensionLoader = new ExtensionLoader(configManager);
const dadJokeService = new DadJokeService();
const completionService = new CompletionService(extensionLoader);

// Handle completion requests before command parsing
if (process.argv.includes("--complete")) {
  const suggestions = await completionService.getSuggestions(process.argv.slice(2));
  console.log(JSON.stringify(suggestions));
  process.exit(0);
}

// Default action - show config info when no arguments provided
program.action(async (options) => {
  // Initialize theme based on config
  const darkMode = configManager.isDarkMode();
  if (darkMode !== undefined) {
    themeChalk.setDarkMode(darkMode);
  }

  if (process.argv.length === 2) {
    await showDashboard();
      } else {
          // Handle specific options
    if (options.setup) {
      await handleSetup();
    } else if (options.config) {
      await handleConfig();
    } else if (options.joke) {
      await handleJoke();
    } else if (options.migrate) {
      await handleMigrate();
    } else if (options.update) {
      await handleUpdate();
    }
    }
});

// Dashboard function
async function showDashboard() {
  // Create header
  console.log(ui.createHeader(
    "🤖 Rodrigo's CLI",
    "A developer-first CLI framework that makes local commands feel native"
  ));

  // Load configuration and extensions with progress
  const config = configManager.getConfig();
  const configPath = configManager.getConfigPath();
  const extensionsDir = configManager.getExtensionsDir();
  
  let extensions: any[] = [];
  try {
    extensions = await withProgress(
      "Loading extensions...",
      () => extensionLoader.loadExtensions(),
      { successText: "Extensions loaded" }
    );
  } catch (error) {
    console.log(ui.error("Failed to load extensions", error instanceof Error ? error.message : String(error)));
  }

  // Configuration panel
  const configItems = [
    { 
      label: "Config file", 
      value: configPath,
      status: existsSync(configPath) ? 'success' as const : 'warning' as const
    },
    { 
      label: "Extensions directory", 
      value: extensionsDir,
      status: existsSync(extensionsDir) ? 'success' as const : 'error' as const
    },
    { 
      label: "Default runner", 
      value: config.defaultRunner || "node"
    },
    { 
      label: "Logging enabled", 
      value: config.enableLogging ? "Yes" : "No",
      status: config.enableLogging ? 'success' as const : undefined
    },
    { 
      label: "Theme mode", 
      value: config.darkMode === null ? "Auto-detect" : config.darkMode ? "Dark" : "Light"
    }
  ];

  console.log(ui.createInfoPanel("📋 Configuration", configItems));
  console.log("");

  // Extensions status
  if (extensions.length > 0) {
    console.log(ui.success(`Found ${extensions.length} extension(s)`, "Run 'rc help' to see all available commands"));
    
    // Show top 5 extensions as a quick preview
    const previewExtensions = extensions.slice(0, 5).map(ext => ({
      command: ext.command,
      description: ext.config?.description || "No description available",
      type: ext.scriptType
    }));
    
    if (previewExtensions.length > 0) {
      console.log("\n" + ui.createBox(
        ui.createCommandList(previewExtensions),
        { title: "🚀 Available Commands (preview)" }
      ));
    }
    
    if (extensions.length > 5) {
      console.log(ui.format.muted(`   ... and ${extensions.length - 5} more commands. Run 'rc help' to see all.`));
    }
  } else {
    console.log(ui.error("No extensions found", "Run 'rc --setup' to create example extensions"));
  }

  // Quick actions
  const quickActions = [
    "rc help                 # Show all available commands",
    "rc --setup              # Create example extensions and setup",
    "rc alias <command>      # Create direct alias for any command",
    "rc --config             # Show detailed configuration",
    "rc --update             # Update to latest version"
  ];

  console.log("\n" + ui.createBox(
    quickActions.map(action => `${ui.icons.lightning} ${ui.format.muted(action)}`).join("\n"),
    { title: "⚡ Quick Actions", borderColor: "yellow", dimBorder: true }
  ));
  
  console.log("");
}

// Handler functions
async function handleSetup() {
  try {
    // Run interactive setup wizard
    const options = await setupWizard.run();
    
    // Confirm before proceeding
    const confirmed = await setupWizard.confirmSetup(options);
    if (!confirmed) {
      console.log(ui.warning("Setup cancelled"));
      return;
    }

    // Execute setup steps based on user choices
    const steps = [];

    if (options.setupXDG) {
      steps.push({
        name: "create-xdg",
        description: "Creating XDG directory structure",
        action: async () => {
          const { XDGPaths } = await import("../utils/xdg-paths.js");
          const xdgDirs = XDGPaths.getAllAppDirs();
          const userExtensionsDir = XDGPaths.getExtensionsDir();
          
          const dirsToCreate = [
            xdgDirs['config'],
            xdgDirs['data'], 
            xdgDirs['cache'],
            xdgDirs['state'],
            userExtensionsDir
          ].filter(Boolean);

          for (const dirPath of dirsToCreate) {
            if (!existsSync(dirPath!)) {
              mkdirSync(dirPath!, { recursive: true });
            }
          }
        }
      });
    }

    if (options.createExamples) {
      steps.push({
        name: "copy-examples",
        description: "Installing example extensions",
        action: async () => {
          const { XDGPaths } = await import("../utils/xdg-paths.js");
          const userExtensionsDir = XDGPaths.getExtensionsDir();
          const exampleExtensionsDir = join(process.cwd(), "examples", "extensions");
          
          if (existsSync(exampleExtensionsDir)) {
            await copyDirectory(exampleExtensionsDir, userExtensionsDir);
            
            // Copy directory-level configs
            const { readdirSync, statSync, copyFileSync } = await import("fs");
            const exampleDirs = readdirSync(exampleExtensionsDir).filter((item: string) =>
              statSync(join(exampleExtensionsDir, item)).isDirectory()
            );

            for (const dir of exampleDirs) {
              const exampleDirPath = join(exampleExtensionsDir, dir);
              const userDirPath = join(userExtensionsDir, dir);
              const dirConfigs = readdirSync(exampleDirPath).filter(
                (item: string) => item === `${dir}.yaml` || item === `${dir}.json`
              );

              for (const config of dirConfigs) {
                const srcConfig = join(exampleDirPath, config);
                const destConfig = join(userDirPath, config);
                copyFileSync(srcConfig, destConfig);
              }
            }
          }
        }
      });
    }

    if (options.createConfig) {
      steps.push({
        name: "create-config",
        description: "Creating configuration file",
        action: async () => {
          const { XDGPaths } = await import("../utils/xdg-paths.js");
          const userExtensionsDir = XDGPaths.getExtensionsDir();
          configManager.createComprehensiveConfig(userExtensionsDir);
        }
      });
    }

    // Execute all setup steps
    await executeWithProgress(steps, { 
      showSuccess: true,
      showErrors: true 
    });

    // Show success message
    console.log("\n" + ui.createBox(
      [
        `${ui.icons.success} Setup completed successfully!`,
        "",
        `Config file: ${configManager.getConfigPath()}`,
        `Extensions: ${configManager.getExtensionsDir()}`,
        "",
        "You can edit the config file to customize rc's behavior.",
        "The config includes detailed comments and examples."
      ].join("\n"),
      { title: "🎉 Setup Complete", borderColor: "green" }
    ));

    // Post-setup options
    if (options.showTutorial) {
      const nextSteps = await setupWizard.showPostSetupOptions();
      
      if (nextSteps.runTutorial) {
        await setupWizard.runTutorial();
      }
      
      if (nextSteps.createAlias) {
        const extensions = await extensionLoader.loadExtensions();
        await setupWizard.runAliasWizard(extensions);
      }
      
      if (nextSteps.viewDashboard) {
        console.log(ui.info("Opening dashboard...", "Run 'rc' anytime to see the main dashboard"));
        console.log("");
        await showDashboard();
      }
    }

  } catch (error) {
    console.log(ui.error("Setup failed", error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function handleConfig() {
  console.log(ui.createHeader("⚙️ Configuration Details", "Comprehensive system configuration and status"));

  const config = configManager.getConfig();
  const configPath = configManager.getConfigPath();

  // Import XDG paths for display
  const { XDGPaths } = await import("../utils/xdg-paths.js");
  const xdgDirs = XDGPaths.getAllAppDirs();

  // Config file info
  const configInfo = [
    { 
      label: "Config file path", 
      value: configPath,
      status: existsSync(configPath) ? 'success' as const : 'error' as const
    },
    { 
      label: "File exists", 
      value: existsSync(configPath) ? "Yes" : "No",
      status: existsSync(configPath) ? 'success' as const : 'error' as const
    }
  ];
  
  console.log(ui.createInfoPanel("📁 Configuration File", configInfo));
  console.log("");

  // XDG directories
  const xdgInfo = [
    { label: "Configuration", value: xdgDirs['config'] || "Not set" },
    { label: "Data", value: xdgDirs['data'] || "Not set" },
    { label: "Cache", value: xdgDirs['cache'] || "Not set" },
    { label: "State", value: xdgDirs['state'] || "Not set" }
  ];
  
  console.log(ui.createInfoPanel("🗂️ XDG Directory Structure", xdgInfo));
  console.log("");

  // Current settings
  const settingsInfo = [
    { label: "Extensions Directory", value: config.extensionsDir || "Not set" },
    { label: "Default Runner", value: config.defaultRunner || "node" },
    { label: "Logging Enabled", value: config.enableLogging ? "Yes" : "No" },
    { 
      label: "Dark Mode", 
      value: config.darkMode === undefined ? "Auto-detect" : config.darkMode ? "Forced Dark" : "Forced Light" 
    }
  ];
  
  console.log(ui.createInfoPanel("🔧 Current Settings", settingsInfo));
  console.log("");

  // Extensions info with table
  const extensions = await withProgress(
    "Loading extensions...",
    () => extensionLoader.loadExtensions()
  );
  
  if (extensions.length > 0) {
    const extensionData = extensions.map(ext => ({
      command: ext.command,
      description: ext.config?.description || "No description",
      type: ext.scriptType
    }));
    
    console.log(ui.createBox(
      ui.createCommandList(extensionData),
      { title: `📦 Extensions (${extensions.length} found)` }
    ));
  } else {
    console.log(ui.error("No extensions found", "Run 'rc --setup' to create example extensions"));
  }
  console.log("");

  // Configuration help
  const helpItems = [
    "extensionsDir: Directory where your extensions are stored",
    "defaultRunner: Default script runner (node, python, ruby, php, bash, sh)",
    "enableLogging: Enable/disable debug logging",
    "darkMode: Theme mode (true=dark, false=light, null=auto-detect)",
    "Run 'rc --setup' to create a comprehensive config file with examples"
  ];
  
  console.log(ui.createBox(
    helpItems.map(item => `${ui.icons.bullet} ${ui.format.muted(item)}`).join("\n"),
    { title: "💡 Configuration Options", borderColor: "blue", dimBorder: true }
  ));
  console.log("");
}

async function handleJoke() {
  console.log(themeChalk.header("\n🎭 Dad Joke\n"));
  const joke = await dadJokeService.getRandomJoke();
  console.log(themeChalk.accent(joke));
  console.log("");
}

async function handleMigrate() {
  console.log(themeChalk.header("\n🔄 XDG Directory Structure\n"));
  
  // Import XDG paths for display
  const { XDGPaths } = await import("../utils/xdg-paths.js");
  const xdgDirs = XDGPaths.getAllAppDirs();
  
  console.log(themeChalk.section("📁 XDG Directory Structure:"));
  console.log(themeChalk.textMuted(`   Configuration: ${xdgDirs['config']}`));
  console.log(themeChalk.textMuted(`   Data: ${xdgDirs['data']}`));
  console.log(themeChalk.textMuted(`   Cache: ${xdgDirs['cache']}`));
  console.log(themeChalk.textMuted(`   State: ${xdgDirs['state']}`));
  
  console.log(themeChalk.section("\n💡 XDG Benefits:"));
  console.log(themeChalk.textMuted("   • Follows XDG Base Directory Specification"));
  console.log(themeChalk.textMuted("   • Better integration with Linux/Unix systems"));
  console.log(themeChalk.textMuted("   • User can customize paths via environment variables"));
  console.log(themeChalk.textMuted("   • Clear separation of config, data, cache, and state"));
  console.log(themeChalk.textMuted("   • Run 'rc --setup' to create XDG directory structure"));
  
  console.log("");
}

async function handleUpdate() {
  console.log(themeChalk.header("\n🔄 Updating Rodrigo's CLI...\n"));

  try {
    // Get the current script's directory to find the installation
    const currentScriptPath = process.argv[1];
    if (!currentScriptPath) {
      console.log(themeChalk.statusError("   ❌ Could not determine script path"));
      return;
    }
    
    const currentScriptDir = dirname(currentScriptPath);
    
    // Look for the installation directory
    let installationDir: string;
    
    // Check if we're in a development environment (running from source)
    if (currentScriptPath.includes('node_modules') || currentScriptPath.includes('src/bin')) {
      console.log(themeChalk.status("   📁 Running from development environment"));
      console.log(themeChalk.textMuted("   💡 Updates are handled by git pull in development"));
      return;
    }
    
    // Check if we're in the user's local bin directory
    if (currentScriptPath.includes('.local/bin')) {
      installationDir = join(currentScriptDir, 'rodrigos-cli');
    } else {
      // Try to find the installation in common locations
      const possiblePaths = [
        join(process.env['HOME'] || '', '.local/bin/rodrigos-cli'),
        '/usr/local/bin/rodrigos-cli',
        '/opt/rodrigos-cli'
      ];
      
      installationDir = possiblePaths.find(path => existsSync(path)) || '';
    }
    
    if (!installationDir || !existsSync(installationDir)) {
      console.log(themeChalk.statusError("   ❌ Could not find installation directory"));
      console.log(themeChalk.textMuted("   💡 Please reinstall using the installer script"));
      return;
    }
    
    console.log(themeChalk.section("📁 Installation found:"));
    console.log(themeChalk.textMuted(`   ${installationDir}`));
    
    // Get the latest version
    console.log(themeChalk.section("\n📥 Checking for updates..."));
    const latestVersion = execSync('curl -s https://api.github.com/repos/rodrigopsasaki/rodrigos-cli/releases/latest | grep \'"tag_name":\' | sed -E \'s/.*"([^"]+)".*/\\1/\'', { encoding: 'utf8' }).trim();
    
    if (!latestVersion) {
      console.log(themeChalk.statusError("   ❌ Could not determine latest version"));
      return;
    }
    
    console.log(themeChalk.status(`   📦 Latest version: ${latestVersion}`));
    
    // Check current version
    const packageJsonPath = join(installationDir, 'package.json');
    let currentVersion = 'unknown';
    
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        currentVersion = packageJson.version || 'unknown';
      } catch (error) {
        // Ignore parsing errors
      }
    }
    
    console.log(themeChalk.textMuted(`   📦 Current version: ${currentVersion}`));
    
    if (currentVersion === latestVersion) {
      console.log(themeChalk.status("   ✅ Already up to date!"));
      return;
    }
    
    // Perform the update
    console.log(themeChalk.section("\n🔄 Updating..."));
    
    // Create a temporary directory for the update
    const tempDir = join(process.env['TEMP'] || process.env['TMP'] || '/tmp', `rc-update-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    try {
      // Clone the latest version
      console.log(themeChalk.textMuted("   📥 Cloning latest version..."));
      execSync(`git clone https://github.com/rodrigopsasaki/rodrigos-cli.git "${tempDir}"`, { stdio: 'pipe' });
      
      // Checkout the specific version
      if (latestVersion !== 'main') {
        execSync(`cd "${tempDir}" && git checkout "${latestVersion}"`, { stdio: 'pipe' });
      }
      
      // Install dependencies
      console.log(themeChalk.textMuted("   📦 Installing dependencies..."));
      execSync(`cd "${tempDir}" && npm install --no-audit --no-fund`, { stdio: 'pipe' });
      
      // Backup current installation
      const backupDir = `${installationDir}.backup.${Date.now()}`;
      console.log(themeChalk.textMuted("   💾 Creating backup..."));
      execSync(`cp -r "${installationDir}" "${backupDir}"`, { stdio: 'pipe' });
      
      // Update the installation
      console.log(themeChalk.textMuted("   🔄 Updating files..."));
      execSync(`rm -rf "${installationDir}/src" "${installationDir}/package.json" "${installationDir}/tsconfig.json" "${installationDir}/node_modules"`, { stdio: 'pipe' });
      execSync(`cp -r "${tempDir}/src" "${installationDir}/"`, { stdio: 'pipe' });
      execSync(`cp "${tempDir}/package.json" "${installationDir}/"`, { stdio: 'pipe' });
      execSync(`cp "${tempDir}/tsconfig.json" "${installationDir}/"`, { stdio: 'pipe' });
      execSync(`cp -r "${tempDir}/node_modules" "${installationDir}/"`, { stdio: 'pipe' });
      
      console.log(themeChalk.status("   ✅ Update completed successfully!"));
      console.log(themeChalk.textMuted(`   💾 Backup saved to: ${backupDir}`));
      
    } finally {
      // Clean up temporary directory
      execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });
    }
    
  } catch (error) {
    console.error(themeChalk.statusError("   ❌ Update failed:"), error);
    console.log(themeChalk.textMuted("   💡 Please try running the installer again"));
  }
}

// Helper function to copy directory recursively
async function copyDirectory(src: string, dest: string) {
  const { readdirSync, statSync, copyFileSync, mkdirSync } = await import("fs");
  const { join } = await import("path");

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
    if (process.argv.includes("--verbose") || process.argv.includes("--debug")) {
      console.log(themeChalk.debug("🔍 [DEBUG] Loaded extensions:"));
      for (const ext of extensions) {
        console.log(themeChalk.debug(`🔍 [DEBUG] - ${ext.command} -> ${ext.scriptPath}`));
      }
      console.log(themeChalk.debug("🔍 [DEBUG] ---"));
    }

    // Group extensions by their main command
    const commandGroups: Record<string, Extension[]> = {};
    for (const extension of extensions) {
      const parts = extension.command.split(" ");
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
            const isVerbose = process.argv.includes("--verbose") || process.argv.includes("--debug");

            if (isVerbose) {
              console.log(themeChalk.debug(`🔍 [DEBUG] Executing extension: ${extension.command}`));
              console.log(themeChalk.debug(`🔍 [DEBUG] Script path: ${extension.scriptPath}`));
              console.log(themeChalk.debug(`🔍 [DEBUG] Script type: ${extension.scriptType}`));
              console.log(themeChalk.debug(`🔍 [DEBUG] Runner: ${extension.config?.runner || "default"}`));
              console.log(themeChalk.debug(`🔍 [DEBUG] Options: ${JSON.stringify(options, null, 2)}`));
              console.log(themeChalk.debug("🔍 [DEBUG] ---"));
            }

            await extensionLoader.executeExtension(extension, options, isVerbose);
          } catch (error) {
            console.error(themeChalk.statusError(`Error executing ${extension.command}:`), error);
            process.exit(1);
          }
        });
      } else {
        // Multiple commands with same prefix, create subcommands
        const mainCmd = program.command(mainCommand);

        // Check if there's a virtual extension for the main command
        const virtualExtension = groupExtensions.find((ext) => ext.command === mainCommand);
        if (virtualExtension) {
          if (virtualExtension.config?.description) {
            mainCmd.description(virtualExtension.config.description);
          }

          // Add options from virtual extension's sidecar config
          if (virtualExtension.config?.options) {
            for (const option of virtualExtension.config.options) {
              const optionStr = option.short
                ? `-${option.short}, --${option.name} <${option.name}>`
                : `--${option.name} <${option.name}>`;

              mainCmd.option(optionStr, option.description);
            }
          }
        }

        for (const extension of groupExtensions) {
          if (!extension) continue;

          // Skip virtual extensions when creating subcommands
          if (extension.command === mainCommand) continue;

          const parts = extension.command.split(" ");
          const subCommand = parts.slice(1).join(" ");

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
              const isVerbose = process.argv.includes("--verbose") || process.argv.includes("--debug");

              if (isVerbose) {
                console.log(themeChalk.debug(`🔍 [DEBUG] Executing extension: ${extension.command}`));
                console.log(themeChalk.debug(`🔍 [DEBUG] Script path: ${extension.scriptPath}`));
                console.log(themeChalk.debug(`🔍 [DEBUG] Script type: ${extension.scriptType}`));
                console.log(themeChalk.debug(`🔍 [DEBUG] Runner: ${extension.config?.runner || "default"}`));
                console.log(themeChalk.debug(`🔍 [DEBUG] Options: ${JSON.stringify(options, null, 2)}`));
                console.log(themeChalk.debug("🔍 [DEBUG] ---"));
              }

              await extensionLoader.executeExtension(extension, options, isVerbose);
            } catch (error) {
              console.error(themeChalk.statusError(`Error executing ${extension.command}:`), error);
              process.exit(1);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error(themeChalk.statusError("Error loading extensions:"), error);
    process.exit(1);
  }
}

// Alias command
program
  .command("alias")
  .description("Create a direct alias for any rc command")
  .argument("<command...>", "The rc command to alias (e.g., 'gen uuid' creates 'uuid' alias)")
  .action(async (commandArgs: string[]) => {
    if (commandArgs.length === 0) {
      console.error(themeChalk.statusError('❌ Please specify a command to alias'));
      console.log(themeChalk.textMuted('Usage: rc alias <command...>'));
      console.log(themeChalk.textMuted('Example: rc alias gen uuid'));
      process.exit(1);
    }

    const fullCommand = commandArgs.join(' ');
    const aliasName = commandArgs[commandArgs.length - 1];
    
    try {
      // Verify the command exists
      const extensions = await extensionLoader.loadExtensions();
      const matchingExtension = extensions.find(ext => ext.command === fullCommand);
      
      if (!matchingExtension) {
        console.error(themeChalk.statusError(`❌ Command "rc ${fullCommand}" not found`));
        console.log(themeChalk.textMuted('Available commands:'));
        for (const ext of extensions.slice(0, 5)) {
          console.log(themeChalk.textMuted(`   rc ${ext.command}`));
        }
        if (extensions.length > 5) {
          console.log(themeChalk.textMuted(`   ... and ${extensions.length - 5} more`));
        }
        process.exit(1);
      }

      // Check if this is a directory-level command (virtual extension)
      const isDirectoryCommand = matchingExtension.scriptPath.endsWith(aliasName as string) && !matchingExtension.scriptPath.includes('.');
      if (isDirectoryCommand) {
        console.error(themeChalk.statusError(`❌ Cannot alias directory command "${fullCommand}"`));
        console.log(themeChalk.textMuted('You can only alias specific commands, not command groups.'));
        console.log(themeChalk.textMuted(`Try aliasing a specific command like "rc ${fullCommand} <subcommand>"`));
        process.exit(1);
      }

      // Create symlink
      const rcBinaryPath = process.argv[1];
      if (!rcBinaryPath) {
        console.error(themeChalk.statusError('Could not determine rc binary path'));
        process.exit(1);
        return; // This satisfies TypeScript's control flow analysis
      }
      
      const aliasPath = join(dirname(rcBinaryPath as string), aliasName as string);
      
      if (existsSync(aliasPath)) {
        console.log(themeChalk.textMuted(`🔗 Alias "${aliasName}" already exists: ${aliasPath}`));
        console.log(themeChalk.textMuted(`   Use "rm ${aliasPath}" to remove it first`));
        return;
      }

      execSync(`ln -sf "${rcBinaryPath}" "${aliasPath}"`);
      console.log(themeChalk.status(`🔗 Created alias: ${aliasName} -> ${aliasPath}`));
      console.log(themeChalk.textMuted(`   "${aliasName}" now runs "rc ${fullCommand}"`));
      
    } catch (error) {
      console.error(themeChalk.statusError(`❌ Failed to create alias "${aliasName}":`), error);
      process.exit(1);
    }
  });

// Completion command
program
  .command("completion")
  .description("Generate shell completion script")
  .argument("<shell>", "Shell type (bash, zsh, fish)")
  .action((shell) => {
    const completionScript = completionService.generateCompletionScript(shell);
    console.log(completionScript);
  });

// Help command with recursive listing
program
  .command("help")
  .description("Show detailed help with all available commands")
  .action(async () => {
    console.log(ui.createHeader("📚 Available Commands", "Complete list of all discovered extensions and commands"));

    const extensions = await withProgress(
      "Loading extensions...",
      async () => {
        const exts = await extensionLoader.loadExtensions();
        return exts;
      },
      { successText: "Extensions loaded" }
    );

    if (extensions.length === 0) {
      console.log(ui.error("No extensions found", "Run 'rc --setup' to create example extensions"));
      return;
    }

    // Create command table
    const commandData = extensions.map((ext: any) => ({
      command: ext.command,
      description: ext.config?.description || "No description available",
      type: ext.scriptType
    }));

    console.log(ui.createBox(
      ui.createCommandList(commandData),
      { title: `🚀 All Commands (${extensions.length} total)` }
    ));

    // Show hierarchical view
    const commandTree = buildCommandTree(extensions);
    const hierarchicalItems = buildHierarchicalItems(commandTree);
    
    if (hierarchicalItems.length > 0) {
      console.log("\n" + ui.createBox(
        ui.createHierarchicalList(hierarchicalItems),
        { title: "📂 Hierarchical View", borderColor: "blue", dimBorder: true }
      ));
    }

    // Quick tips
    const tips = [
      "Use 'rc <command>' to execute any command",
      "Use 'rc alias <command>' to create direct aliases",
      "Add --verbose to any command for debug information",
      "Commands are auto-discovered from your extensions directory"
    ];

    console.log("\n" + ui.createBox(
      tips.map(tip => `${ui.icons.bullet} ${ui.format.muted(tip)}`).join("\n"),
      { title: "💡 Tips", borderColor: "yellow", dimBorder: true }
    ));
    
    console.log("");
  });

function buildCommandTree(extensions: any[]) {
  const tree: Record<string, any> = {};

  for (const ext of extensions) {
    const parts = ext.command.split(" ");
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        // Only set description if this is the final part (the extension itself)
        // or if this is a virtual extension (same command as the part)
        const shouldSetDescription = i === parts.length - 1 || ext.command === part;
        current[part] = {
          description: shouldSetDescription ? ext.config?.description : undefined,
          children: {},
          isVirtual: ext.command === part, // Mark virtual extensions
        };
      }
      if (i === parts.length - 1) {
        current[part].extension = ext;
      }
      current = current[part].children;
    }
  }

  return tree;
}

// Removed printCommandTree function as it's no longer used

function buildHierarchicalItems(tree: Record<string, any>): Array<{ 
  label: string; 
  children?: Array<{ label: string; description?: string }>;
  description?: string;
  icon?: string;
}> {
  const items: Array<{ 
    label: string; 
    children?: Array<{ label: string; description?: string }>;
    description?: string;
    icon?: string;
  }> = [];

  for (const [command, info] of Object.entries(tree)) {
    const hasChildren = Object.keys(info.children).length > 0;
    
    const item: { 
      label: string; 
      children?: Array<{ label: string; description?: string }>;
      description?: string;
      icon?: string;
    } = {
      label: command,
      description: info.description,
      icon: hasChildren ? ui.icons.folder : ui.icons.file
    };

    if (hasChildren) {
      item.children = [];
      for (const [childCommand, childInfo] of Object.entries(info.children)) {
        item.children.push({
          label: childCommand,
          description: (childInfo as any)?.description
        });
      }
    }

    items.push(item);
  }

  return items;
}

// Handle execution when called via alias
async function handleAliasedExecution(aliasCommand: string): Promise<void> {
  const configManager = new ConfigManager();
  const extensionLoader = new ExtensionLoader(configManager);
  
  try {
    const extensions = await extensionLoader.loadExtensions();
    const additionalArgs = process.argv.slice(2);
    
    // Find extensions that end with the alias command
    const matchingExtensions = extensions.filter(ext => {
      const commandParts = ext.command.split(' ');
      return commandParts[commandParts.length - 1] === aliasCommand;
    });
    
    if (matchingExtensions.length === 0) {
      console.error(themeChalk.statusError(`❌ No command ending with "${aliasCommand}" found`));
      process.exit(1);
    }
    
    if (matchingExtensions.length > 1) {
      console.error(themeChalk.statusError(`❌ Multiple commands end with "${aliasCommand}":`));
      for (const ext of matchingExtensions) {
        console.log(themeChalk.textMuted(`   rc ${ext.command}`));
      }
      console.log(themeChalk.textMuted(`\nBe more specific or use the full "rc" command.`));
      process.exit(1);
    }
    
    // Found exactly one match - execute it with additional arguments
    const extension = matchingExtensions[0];
    if (!extension) {
      console.error(themeChalk.statusError('No matching extension found'));
      process.exit(1);
    }
    
    // Update process.argv to include any additional arguments for the extension
    process.argv = [process.argv[0] || 'node', process.argv[1] || 'rc', ...extension.command.split(' '), ...additionalArgs];
    
    // Parse remaining arguments as options
    const options: Record<string, any> = {};
    
    await extensionLoader.executeExtension(extension, options);
    process.exit(0);
    
  } catch (error) {
    console.error(themeChalk.statusError('Error executing aliased command:'), error);
    process.exit(1);
  }
}

// Parse arguments and run
async function main() {
  await loadExtensions();
  await program.parseAsync();
}

main().catch((error) => {
  console.error(themeChalk.statusError("Fatal error:"), error);
  process.exit(1);
});
