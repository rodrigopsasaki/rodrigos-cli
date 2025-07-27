#!/usr/bin/env node

import { Command } from "commander";
import { existsSync, readFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { ExtensionLoader } from "../core/extension-loader.js";
import { ConfigManager } from "../core/config-manager.js";
import { DadJokeService } from "../utils/dad-joke-service.js";
import { CompletionService } from "../core/completion-service.js";
import { themeChalk } from "../utils/chalk.js";
import { XDGPaths } from "../utils/xdg-paths.js";
import type { Extension } from "../types/index.js";
import { basename } from "path";

// Detect if we're being called via a namespace alias
const binaryName = basename(process.argv[1] || '');
const isAliased = binaryName !== 'rc' && binaryName !== 'rc.js' && binaryName !== 'rc-immutable' && binaryName !== 'rc-immutable.js';
const aliasNamespace = isAliased ? binaryName : null;

// If called via alias, inject namespace into arguments
if (aliasNamespace) {
  // Transform: ['node', '/path/to/company', 'aws', 'login'] 
  // Into: ['node', '/path/to/rc', 'company', 'aws', 'login']
  process.argv.splice(2, 0, aliasNamespace);
}

const program = new Command();

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
    console.log(themeChalk.header("\n🤖 Rodrigo's CLI\n"));

    // Show current configuration
    const config = configManager.getConfig();
    const configPath = configManager.getConfigPath();

    console.log(themeChalk.section("📁 Configuration:"));
    console.log(themeChalk.textMuted(`   Config file: ${configPath}`));
    console.log(themeChalk.textMuted(`   Extensions dir: ${config.extensionsDir}`));
    console.log(themeChalk.textMuted(`   Namespaces dir: ${XDGPaths.getNamespacesDir()}`));
    console.log(themeChalk.textMuted(`   Default runner: ${config.defaultRunner}`));
    console.log(themeChalk.textMuted(`   Logging enabled: ${config.enableLogging}`));

    // Check if extensions directory exists and has extensions
    const extensionsDir = configManager.getExtensionsDir();
    const hasExtensions = await extensionLoader.loadExtensions().then((exts) => exts.length > 0);

    console.log(themeChalk.section("\n📦 Extensions:"));
    if (hasExtensions) {
      const extensions = await extensionLoader.loadExtensions();
      const legacyExtensions = extensions.filter(ext => !ext.namespace);
      const namespacedExtensions = extensions.filter(ext => ext.namespace);
      const namespaces = [...new Set(namespacedExtensions.map(ext => ext.namespace))];
      
      if (legacyExtensions.length > 0) {
        console.log(themeChalk.status(`   ✅ Found ${legacyExtensions.length} extension(s) in: ${extensionsDir}`));
      }
      
      if (namespaces.length > 0) {
        console.log(themeChalk.status(`   ✅ Found ${namespaces.length} namespace(s): ${namespaces.join(', ')}`));
      }
      
      console.log(themeChalk.textMuted('   Run "rc help" to see available commands'));
    } else {
      console.log(themeChalk.statusError(`   ❌ No extensions found in: ${extensionsDir}`));
      console.log(themeChalk.textMuted('   Run "rc --setup" to create example extensions'));
    }

    console.log(themeChalk.section("\n🚀 Quick Start:"));
    console.log(themeChalk.textMuted("   rc help              # Show available commands"));
    console.log(themeChalk.textMuted("   rc --setup           # Create example extensions"));
    console.log(themeChalk.textMuted("   rc namespace list    # List all namespaces"));
    console.log(themeChalk.textMuted("   rc namespace add     # Add a new namespace"));
    console.log(themeChalk.textMuted("   rc --config          # Show detailed config info"));
    console.log(themeChalk.textMuted("   rc --migrate         # Show XDG directory structure"));
    console.log(themeChalk.textMuted("   rc --joke            # Show a dad joke"));
    console.log(themeChalk.textMuted("   rc --update          # Update to latest version"));
    console.log("");
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

// Handler functions
async function handleSetup() {
  console.log(themeChalk.header("\n🔧 Setting up Rodrigo's CLI...\n"));

  try {
    // Import required modules
    const { mkdirSync, readdirSync, statSync, copyFileSync } = await import("fs");
    const { join } = await import("path");
    const { XDGPaths } = await import("../utils/xdg-paths.js");

    // Use XDG-compliant paths
    const userExtensionsDir = XDGPaths.getExtensionsDir();
    const namespacesDir = XDGPaths.getNamespacesDir();

    // Create XDG directory structure
    console.log(themeChalk.section("📁 Creating XDG directory structure..."));
    
    const xdgDirs = XDGPaths.getAllAppDirs();
    const dirsToCreate = [
      { path: xdgDirs['config'], name: "Configuration" },
      { path: xdgDirs['data'], name: "Data" },
      { path: xdgDirs['cache'], name: "Cache" },
      { path: xdgDirs['state'], name: "State" },
      { path: userExtensionsDir, name: "Extensions" },
      { path: namespacesDir, name: "Namespaces" }
    ];

    for (const dir of dirsToCreate) {
      if (dir.path && !existsSync(dir.path)) {
        mkdirSync(dir.path, { recursive: true });
        console.log(themeChalk.status(`   ✅ Created ${dir.name}: ${dir.path}`));
      } else if (dir.path) {
        console.log(themeChalk.textMuted(`   📁 ${dir.name} already exists: ${dir.path}`));
      }
    }

    // Copy example extensions
    const exampleExtensionsDir = join(process.cwd(), "examples", "extensions");
    if (existsSync(exampleExtensionsDir)) {
      console.log(themeChalk.section("\n📦 Copying example extensions..."));
      await copyDirectory(exampleExtensionsDir, userExtensionsDir);
      console.log(themeChalk.status("   ✅ Example extensions copied"));

      // Also copy any directory-level sidecar configs that might be in the examples
      console.log(themeChalk.section("\n📋 Copying directory configs..."));
      const exampleDirs = readdirSync(exampleExtensionsDir).filter((item: string) =>
        statSync(join(exampleExtensionsDir, item)).isDirectory(),
      );

      for (const dir of exampleDirs) {
        const exampleDirPath = join(exampleExtensionsDir, dir);
        const userDirPath = join(userExtensionsDir, dir);

        // Look for directory-level configs (e.g., gen.yaml, gen.json)
        const dirConfigs = readdirSync(exampleDirPath).filter(
          (item: string) => item === `${dir}.yaml` || item === `${dir}.json`,
        );

        for (const config of dirConfigs) {
          const srcConfig = join(exampleDirPath, config);
          const destConfig = join(userDirPath, config);
          copyFileSync(srcConfig, destConfig);
          console.log(themeChalk.textMuted(`   📄 Copied: ${config}`));
        }
      }
    }

    // Create comprehensive configuration file
    console.log(themeChalk.section("\n⚙️  Creating comprehensive configuration..."));
    
    configManager.createComprehensiveConfig(userExtensionsDir);
    console.log(themeChalk.status("   ✅ Comprehensive configuration created"));
    
    // Show the user what was created
    console.log(themeChalk.textMuted("   📄 Config file location:"));
    console.log(themeChalk.path(`      ${configManager.getConfigPath()}`));
    console.log(themeChalk.textMuted("   💡 You can edit this file to customize rc's behavior"));
    console.log(themeChalk.textMuted("   📖 The config file includes detailed comments and examples"));

    console.log(themeChalk.status("\n🎉 Setup complete!"));
    console.log(themeChalk.textMuted('   Run "rc" to see your extensions'));
    console.log(themeChalk.textMuted('   Run "rc help" to see available commands'));
    console.log("");
  } catch (error) {
    console.error(themeChalk.statusError("❌ Setup failed:"), error);
    process.exit(1);
  }
}

async function handleConfig() {
  console.log(themeChalk.header("\n⚙️  Configuration Details\n"));

  const config = configManager.getConfig();
  const configPath = configManager.getConfigPath();

  // Import XDG paths for display
  const { XDGPaths } = await import("../utils/xdg-paths.js");
  const xdgDirs = XDGPaths.getAllAppDirs();

  console.log(themeChalk.section("📁 Config File:"));
  console.log(themeChalk.textMuted(`   Path: ${configPath}`));
  console.log(themeChalk.textMuted(`   Exists: ${existsSync(configPath) ? "Yes" : "No"}`));

  console.log(themeChalk.section("\n🗂️  XDG Directory Structure:"));
  console.log(themeChalk.textMuted(`   Configuration: ${xdgDirs['config']}`));
  console.log(themeChalk.textMuted(`   Data: ${xdgDirs['data']}`));
  console.log(themeChalk.textMuted(`   Cache: ${xdgDirs['cache']}`));
  console.log(themeChalk.textMuted(`   State: ${xdgDirs['state']}`));

  console.log(themeChalk.section("\n🔧 Settings:"));
  console.log(themeChalk.textMuted(`   Extensions Directory: ${config.extensionsDir}`));
  console.log(themeChalk.textMuted(`   Namespaces Directory: ${XDGPaths.getNamespacesDir()}`));
  console.log(themeChalk.textMuted(`   Default Runner: ${config.defaultRunner}`));
  console.log(themeChalk.textMuted(`   Logging Enabled: ${config.enableLogging}`));
  console.log(themeChalk.textMuted(`   Dark Mode: ${config.darkMode === undefined ? "Auto-detect" : config.darkMode ? "Forced Dark" : "Forced Light"}`));

  // Show extensions info
  const extensions = await extensionLoader.loadExtensions();
  const legacyExtensions = extensions.filter(ext => !ext.namespace);
  const namespacedExtensions = extensions.filter(ext => ext.namespace);
  const namespaces = [...new Set(namespacedExtensions.map(ext => ext.namespace))];

  console.log(themeChalk.section("\n📦 Extensions:"));
  console.log(themeChalk.textMuted(`   Found: ${extensions.length} extension(s) total`));
  console.log(themeChalk.textMuted(`   Legacy: ${legacyExtensions.length} extension(s)`));
  console.log(themeChalk.textMuted(`   Namespaced: ${namespacedExtensions.length} extension(s) across ${namespaces.length} namespace(s)`));

  if (legacyExtensions.length > 0) {
    console.log(themeChalk.textMuted("\n   Legacy Extensions:"));
    for (const ext of legacyExtensions) {
      console.log(themeChalk.textMuted(`   - ${ext.command} (${ext.scriptType})`));
    }
  }

  // Show namespaces info
  console.log(themeChalk.section("\n📂 Namespaces:"));
  
  const namespacesDir = XDGPaths.getNamespacesDir();
  if (!existsSync(namespacesDir)) {
    console.log(themeChalk.textMuted("   No namespaces directory found"));
    console.log(themeChalk.textMuted(`   Directory would be: ${namespacesDir}`));
  } else {
    try {
      const { readdirSync, statSync } = await import("fs");
      const namespacesDirs = readdirSync(namespacesDir).filter(item => {
        const itemPath = join(namespacesDir, item);
        return statSync(itemPath).isDirectory();
      });

      if (namespacesDirs.length === 0) {
        console.log(themeChalk.textMuted("   No namespaces found"));
        console.log(themeChalk.textMuted(`   Directory: ${namespacesDir}`));
      } else {
        console.log(themeChalk.textMuted(`   Found: ${namespacesDirs.length} namespace(s)`));
        console.log(themeChalk.textMuted(`   Root directory: ${namespacesDir}`));
        
        for (const namespace of namespacesDirs) {
          const namespacePath = XDGPaths.getNamespaceDir(namespace);
          const namespaceExtensions = extensions.filter(ext => ext.namespace === namespace);
          console.log(themeChalk.textMuted(`   - ${namespace} (${namespaceExtensions.length} commands) -> ${namespacePath}`));
        }
      }
    } catch (error) {
      console.log(themeChalk.textMuted("   Error reading namespaces directory"));
    }
  }

  console.log(themeChalk.section("\n💡 Configuration Options:"));
  console.log(themeChalk.textMuted("   • extensionsDir: Directory where your extensions are stored"));
  console.log(themeChalk.textMuted("   • defaultRunner: Default script runner (node, python, ruby, php, bash, sh)"));
  console.log(themeChalk.textMuted("   • enableLogging: Enable/disable debug logging"));
  console.log(themeChalk.textMuted("   • darkMode: Theme mode (true=dark, false=light, null=auto-detect)"));
  console.log(themeChalk.textMuted("   • Run 'rc --setup' to create a comprehensive config file with examples"));

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

// Namespace management commands
const namespaceCmd = program.command("namespace");
namespaceCmd.description("Manage command namespaces");

namespaceCmd
  .command("add")
  .description("Add a new namespace")
  .argument("<name>", "Namespace name")
  .option("-u, --url <url>", "Git repository URL to clone")
  .option("--no-alias", "Don't create a symlink alias for direct access")
  .action(async (name, options) => {
    const namespacePath = XDGPaths.getNamespaceDir(name);
    
    if (existsSync(namespacePath)) {
      console.log(themeChalk.statusError(`❌ Namespace "${name}" already exists`));
      return;
    }

    try {
      mkdirSync(namespacePath, { recursive: true });
      
      if (options.url) {
        console.log(themeChalk.status(`📦 Cloning ${options.url} into namespace "${name}"...`));
        execSync(`git clone "${options.url}" "${namespacePath}"`, { stdio: 'inherit' });
      } else {
        console.log(themeChalk.status(`📁 Created local namespace "${name}"`));
        console.log(themeChalk.textMuted(`   Directory: ${namespacePath}`));
        console.log(themeChalk.textMuted(`   Add scripts to this directory to make them available as "rc ${name} <command>"`));
      }
      
      // Create symlink alias unless disabled
      if (options.alias !== false) {
        try {
          // Find the current rc binary location
          const rcBinaryPath = process.argv[1];
          if (!rcBinaryPath) {
            throw new Error("Could not determine rc binary path");
          }
          const aliasPath = join(dirname(rcBinaryPath), name);
          
          // Create symlink if it doesn't exist
          if (!existsSync(aliasPath)) {
            execSync(`ln -sf "${rcBinaryPath}" "${aliasPath}"`);
            console.log(themeChalk.status(`🔗 Created alias: ${name} -> ${aliasPath}`));
            console.log(themeChalk.textMuted(`   Now you can use "${name} <command>" directly`));
          } else {
            console.log(themeChalk.textMuted(`🔗 Alias already exists: ${aliasPath}`));
          }
        } catch (error) {
          console.log(themeChalk.statusError(`⚠️  Failed to create alias: ${error}`));
          console.log(themeChalk.textMuted(`   You can still use "rc ${name} <command>"`));
        }
      }
      
      // Invalidate extension cache to pick up new namespace
      extensionLoader.invalidateCache();
      
      console.log(themeChalk.status(`✅ Namespace "${name}" added successfully`));
    } catch (error) {
      console.error(themeChalk.statusError(`❌ Failed to add namespace "${name}":`), error);
      process.exit(1);
    }
  });

namespaceCmd
  .command("list")
  .description("List all namespaces")
  .action(async () => {
    const namespacesDir = XDGPaths.getNamespacesDir();
    
    if (!existsSync(namespacesDir)) {
      console.log(themeChalk.textMuted("No namespaces found"));
      console.log(themeChalk.textMuted('Use "rc namespace add <name>" to create your first namespace'));
      return;
    }

    try {
      const namespaces = readdirSync(namespacesDir).filter(item => {
        const itemPath = join(namespacesDir, item);
        return statSync(itemPath).isDirectory();
      });

      if (namespaces.length === 0) {
        console.log(themeChalk.textMuted("No namespaces found"));
        console.log(themeChalk.textMuted('Use "rc namespace add <name>" to create your first namespace'));
        return;
      }

      console.log(themeChalk.header("📦 Namespaces:\n"));
      
      const extensions = await extensionLoader.loadExtensions();
      
      for (const namespace of namespaces) {
        const namespacePath = XDGPaths.getNamespaceDir(namespace);
        const namespaceExtensions = extensions.filter(ext => ext.namespace === namespace);
        
        console.log(themeChalk.primary(`📁 ${namespace}`));
        console.log(themeChalk.textMuted(`   Path: ${namespacePath}`));
        
        // Check if alias exists
        try {
          const rcBinaryPath = process.argv[1];
          if (rcBinaryPath) {
            const aliasPath = join(dirname(rcBinaryPath), namespace);
            if (existsSync(aliasPath)) {
              console.log(themeChalk.textMuted(`   Alias: ${namespace} -> ${aliasPath}`));
            }
          }
        } catch (error) {
          // Ignore alias check errors
        }
        
        if (namespaceExtensions.length > 0) {
          console.log(themeChalk.textMuted(`   Commands: ${namespaceExtensions.length}`));
          for (const ext of namespaceExtensions.slice(0, 3)) {
            console.log(themeChalk.textMuted(`     • rc ${ext.command} or ${namespace} ${ext.command.replace(namespace + ' ', '')}`));
          }
          if (namespaceExtensions.length > 3) {
            console.log(themeChalk.textMuted(`     ... and ${namespaceExtensions.length - 3} more`));
          }
        } else {
          console.log(themeChalk.textMuted("   Commands: 0"));
        }
        console.log("");
      }
    } catch (error) {
      console.error(themeChalk.statusError("❌ Failed to list namespaces:"), error);
      process.exit(1);
    }
  });

namespaceCmd
  .command("remove")
  .description("Remove a namespace")
  .argument("<name>", "Namespace name")
  .option("-f, --force", "Force removal without confirmation")
  .action(async (name, options) => {
    const namespacePath = XDGPaths.getNamespaceDir(name);
    
    if (!existsSync(namespacePath)) {
      console.log(themeChalk.statusError(`❌ Namespace "${name}" not found`));
      return;
    }

    if (!options.force) {
      console.log(themeChalk.status(`⚠️  This will permanently delete namespace "${name}" and all its contents`));
      console.log(themeChalk.textMuted(`   Path: ${namespacePath}`));
      console.log(themeChalk.textMuted('   Use --force to proceed without this confirmation'));
      return;
    }

    try {
      // Remove the namespace directory
      execSync(`rm -rf "${namespacePath}"`, { stdio: 'inherit' });
      
      // Remove symlink alias if it exists
      try {
        const rcBinaryPath = process.argv[1];
        if (!rcBinaryPath) {
          throw new Error("Could not determine rc binary path");
        }
        const aliasPath = join(dirname(rcBinaryPath), name);
        
        if (existsSync(aliasPath)) {
          execSync(`rm -f "${aliasPath}"`);
          console.log(themeChalk.status(`🔗 Removed alias: ${aliasPath}`));
        }
      } catch (error) {
        console.log(themeChalk.statusError(`⚠️  Failed to remove alias: ${error}`));
      }
      
      // Invalidate extension cache
      extensionLoader.invalidateCache();
      
      console.log(themeChalk.status(`✅ Namespace "${name}" removed successfully`));
    } catch (error) {
      console.error(themeChalk.statusError(`❌ Failed to remove namespace "${name}":`), error);
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
    console.log(themeChalk.header("\n📚 Available Commands\n"));

    const extensions = await extensionLoader.loadExtensions();
    const commandTree = buildCommandTree(extensions);
    printCommandTree(commandTree, 0);
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

function printCommandTree(tree: Record<string, any>, depth: number) {
  const indent = "  ".repeat(depth);

  for (const [command, info] of Object.entries(tree)) {
    const hasChildren = Object.keys(info.children).length > 0;
    const icon = hasChildren ? "📁" : "⚡";
    const desc = info.description ? themeChalk.textMuted(` - ${info.description}`) : "";

    console.log(`${indent}${icon} ${themeChalk.primary(command)}${desc}`);

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
  console.error(themeChalk.statusError("Fatal error:"), error);
  process.exit(1);
});
