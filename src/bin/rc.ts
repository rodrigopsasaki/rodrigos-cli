#!/usr/bin/env node

import { Command } from "commander";
import { existsSync, statSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";

import { ConfigManager } from "../core/config-manager.js";
import { ExtensionLoader } from "../core/extension-loader.js";
import { Extension } from "../types/index.js";
import { ui } from "../utils/ui.js";
import { themeChalk } from "../utils/chalk.js";
import { withProgress } from "../utils/progress.js";
import { SetupWizard } from "../utils/wizard.js";
import { CompletionService } from "../core/completion-service.js";
import { getVersion } from "../utils/version.js";
import { XDGPaths } from "../utils/xdg-paths.js";

// Helper function to check if aliasing is enabled
function isAliasingEnabled(): boolean {
  return process.env['RC_ALIASING_ENABLED'] === '1';
}

const program = new Command();
const configManager = new ConfigManager();
const extensionLoader = new ExtensionLoader(configManager);
const completionService = new CompletionService(extensionLoader);

// Handle aliased execution before normal command processing
if (process.argv[2] && !process.argv[2].startsWith('-') && !['help', 'doctor', 'completion', 'alias', 'alias-init'].includes(process.argv[2])) {
  const aliasCommand = process.argv[2];
  if (!['--setup', '--config', '--version', '--update'].includes(aliasCommand)) {
    await handleAliasedExecution(process.argv.slice(2));
  }
}

program
  .name("rc")
  .description("Rodrigo's CLI - A developer-first CLI framework")
  .version(getVersion())
  .option("--setup", "Interactive setup with examples")
  .option("--setup-quick", "Quick non-interactive setup with examples")
  .option("--config", "Show configuration details") 
  .option("--update", "Update to latest version")
  .option("--verbose", "Enable verbose output");

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

    // Filter out virtual directory-level extensions and wrapper scripts for display
    const actualExtensions = extensions.filter(ext => !isVirtualExtension(ext) && !isWrapperScript(ext));
    
    // Group extensions by script path to show main commands with their aliases
    const commandMap = new Map<string, any>();
    
    for (const ext of actualExtensions) {
      // Skip if we already have the main command for this script
      if (commandMap.has(ext.scriptPath)) continue;
      
      // Find all extensions for this script path (main command + aliases)
      const relatedExtensions = actualExtensions.filter(e => e.scriptPath === ext.scriptPath);
      
      // Find the main command (the one without an alias-like suffix or the first one)
      let mainExtension = relatedExtensions[0];
      
      // If no main extension found, skip this entry
      if (!mainExtension) continue;
      
      // If there are multiple commands for the same script, try to identify the main one
      if (relatedExtensions.length > 1) {
        // Look for the extension that has aliases defined in its config
        const extensionWithAliases = relatedExtensions.find(e => e.config?.aliases && e.config.aliases.length > 0);
        if (extensionWithAliases) {
          mainExtension = extensionWithAliases;
        } else {
          // If no extension has aliases, prefer shorter commands (directory-level commands)
          const sortedExtensions = relatedExtensions.sort((a, b) => a.command.length - b.command.length);
          mainExtension = sortedExtensions[0] || mainExtension;
        }
      }
      
      // Collect all aliases for this command
      const allAliases: string[] = [];
      
      // Add aliases from config
      if (mainExtension.config?.aliases && Array.isArray(mainExtension.config.aliases)) {
        const baseCommand = mainExtension.command.split(' ').slice(0, -1);
        for (const alias of mainExtension.config.aliases) {
          const aliasCommand = baseCommand.length > 0 ? [...baseCommand, alias].join(' ') : alias;
          allAliases.push(aliasCommand);
        }
      }
      
      // Add any additional extensions that share the same script path but have different commands
      // (but skip ones already covered by the aliases config)
      const aliasCommands = new Set(allAliases);
      for (const relatedExt of relatedExtensions) {
        if (relatedExt.command !== mainExtension.command && !aliasCommands.has(relatedExt.command)) {
          allAliases.push(relatedExt.command);
        }
      }
      
      commandMap.set(ext.scriptPath, {
        command: mainExtension.command,
        description: mainExtension.config?.description || "No description available",
        type: mainExtension.scriptType,
        aliases: allAliases
      });
    }
    
    const commandData = Array.from(commandMap.values());

    console.log(ui.createBox(
      ui.createCommandList(commandData),
      { title: `🚀 All Commands (${commandData.length} unique, ${actualExtensions.length} total including aliases)` }
    ));

    // Show hierarchical view using the same command grouping
    const hierarchicalItems = buildHierarchicalItemsFromCommandMap(commandData);
    
    if (hierarchicalItems.length > 0) {
      console.log("\n" + ui.createBox(
        ui.createHierarchicalList(hierarchicalItems),
        { title: "📂 Hierarchical View", borderColor: "blue", dimBorder: true }
      ));
    }

    // Quick tips - emphasize alias setup if not configured
    const tips: string[] = [];
    
    if (!isAliasingEnabled()) {
      tips.push("🚀 SETUP ALIASES: Run 'eval \"$(rc alias-init)\"' to enable direct command shortcuts!");
      tips.push("");
    }
    
    tips.push(
      "Use 'rc <command>' to execute any command",
      "Use 'rc alias <command>' to create command wrappers",
      "Add --verbose to any command for debug information",
      "Commands are auto-discovered from your extensions directory"
    );

    console.log("\n" + ui.createBox(
      tips.map(tip => tip === "" ? "" : `${ui.icons.bullet} ${tip === tips[0] && !isAliasingEnabled() ? tip : ui.format.muted(tip)}`).join("\n"),
      { title: "💡 Tips", borderColor: isAliasingEnabled() ? "yellow" : "red", dimBorder: !isAliasingEnabled() }
    ));
    
    console.log("");
  });

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
      let matchingExtension = extensions.find(ext => ext.command === fullCommand);
      
      // If no exact match, check if it's a directory-level command
      if (!matchingExtension) {
        const directoryCommands = extensions.filter(ext => ext.command.startsWith(`${fullCommand} `));
        if (directoryCommands.length > 0) {
          // Create a virtual extension for directory aliasing
          matchingExtension = {
            command: fullCommand,
            scriptPath: fullCommand, // This will trigger directory command detection
            scriptType: 'virtual',
            config: {
              description: `Directory commands for ${fullCommand}`,
              runner: 'virtual',
              passContext: false
            }
          } as Extension;
        }
      }
      
      if (!matchingExtension) {
        // Check if this might be a directory we should create
        const extensionsDirs = configManager.getExtensionsDirs();
        let potentialDir: string | null = null;
        
        // For nested commands like "cbh npm", try to find the parent directory
        if (commandArgs.length > 1) {
          const parentCommand = commandArgs.slice(0, -1).join('/');
          for (const baseDir of extensionsDirs) {
            const candidateDir = join(baseDir, parentCommand);
            if (existsSync(candidateDir)) {
              potentialDir = candidateDir;
              break;
            }
          }
        }
        
        // For single commands, check if we should create them
        if (!potentialDir) {
          for (const baseDir of extensionsDirs) {
            const candidateDir = join(baseDir, fullCommand);
            if (existsSync(candidateDir)) {
              potentialDir = candidateDir;
              break;
            }
          }
        }
        
        if (!potentialDir) {
          console.error(themeChalk.statusError(`❌ Command "${fullCommand}" not found and no directory exists to create it`));
          console.log(themeChalk.textMuted('Available commands:'));
          const sortedExtensions = extensions.sort((a, b) => a.command.localeCompare(b.command));
          for (const ext of sortedExtensions.slice(0, 10)) {
            console.log(themeChalk.textMuted(`  • ${ext.command}`));
          }
          if (sortedExtensions.length > 10) {
            console.log(themeChalk.textMuted(`  ... and ${sortedExtensions.length - 10} more`));
          }
          console.log(themeChalk.textMuted(`\nTo create a directory-based alias, ensure the directory exists first.`));
          process.exit(1);
        }
      }

      // Get rc binary path
      const rcBinaryPath = process.argv[1];
      if (!rcBinaryPath) {
        console.error(themeChalk.statusError('Could not determine rc binary path'));
        process.exit(1);
        return; // This satisfies TypeScript's control flow analysis
      }

      // Check if this is a directory-level command (virtual extension)
      if (matchingExtension) {
        const isDirectoryCommand = matchingExtension.scriptPath === aliasName || (matchingExtension.scriptPath.endsWith(aliasName as string) && !matchingExtension.scriptPath.includes('.'));
        if (isDirectoryCommand) {
          // Create directory-level alias - generate wrapper script
          await createDirectoryAlias(aliasName as string, extensions, rcBinaryPath, fullCommand);
          return;
        }
      }

      // Create symlink for individual commands
      
      const aliasPath = join(dirname(rcBinaryPath), aliasName as string);
      
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

// Alias-init command - generates shell aliases based on directory configs
program
  .command("alias-init")
  .description("Generate shell aliases for all aliasable directories")
  .action(async () => {
    await handleAliasInit();
  });

// Default action when no command is provided - only if no global options are set
program.action(async () => {
  const options = program.opts();
  
  // Handle global options first
  if (options['setup']) {
    await handleSetup(options);
    return;
  }

  if (options['setupQuick']) {
    await handleQuickSetup();
    return;
  }

  if (options['config']) {
    await handleConfig();
    return;
  }

  if (options['update']) {
    await handleUpdate();
    return;
  }

  // If no global options, show dashboard
  await showDashboard();
});

// Main execution function
async function main() {
  program.parse();
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Dashboard is now handled by the default program action

async function showDashboard() {
  console.log(ui.createHeader("🚀 Rodrigo's CLI", "Your developer-first command center"));

  const extensions = await withProgress(
    "Loading extensions...",
    async () => {
      try {
        const exts = await extensionLoader.loadExtensions();
        return exts;
      } catch (error) {
        console.error("Error loading extensions:", error);
        return [];
      }
    },
    { successText: "Extensions loaded" }
  );

  if (extensions.length > 0) {
    // Filter out virtual extensions and wrapper scripts for main display
    const actualExtensions = extensions.filter(ext => !isVirtualExtension(ext) && !isWrapperScript(ext));
    
    // Group by main commands (filter out aliases)
    const mainCommands = actualExtensions.filter((ext, _index, arr) => {
      const scriptCommands = arr.filter(e => e.scriptPath === ext.scriptPath);
      // Keep only the shortest command for each script (main command)
      return ext.command === scriptCommands.sort((a, b) => a.command.length - b.command.length)[0]?.command;
    });

    const recentCommands = mainCommands.slice(0, 8).map(ext => ({
      command: ext.command,
      description: ext.config?.description || "No description available",
      type: ext.scriptType
    }));

    console.log(ui.createBox(
      ui.createCommandList(recentCommands),
      { title: `⭐ Available Commands (${actualExtensions.length} total)` }
    ));

    // Show hierarchical structure
    const hierarchicalItems = buildHierarchicalItems(actualExtensions);
    
    if (hierarchicalItems.length > 0) {
      console.log("\n" + ui.createBox(
        ui.createHierarchicalList(hierarchicalItems.slice(0, 10)),
        { title: "📂 Command Structure", borderColor: "blue", dimBorder: true }
      ));
    }
  } else {
    console.log(ui.error("No extensions found", "Run 'rc --setup' to create example extensions"));
  }

  // Quick actions
  const quickActions = [
    "rc help                 # Show all available commands",
    "rc doctor               # Diagnose conflicts and configuration",
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

// Build hierarchical items for display
function buildHierarchicalItems(extensions: Extension[]): Array<{ 
  label: string; 
  children?: Array<{ label: string; description?: string }>;
  description?: string;
  icon?: string;
}> {
  const tree: Record<string, any> = {};
  
  // Build tree structure from extensions
  for (const ext of extensions) {
    const parts = ext.command.split(" ");
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      if (!current[part]) {
        current[part] = {
          label: part,
          children: {},
          isLeaf: i === parts.length - 1
        };
        
        // Add description only for leaf nodes (actual commands)
        if (i === parts.length - 1) {
          current[part].description = ext.config?.description || "No description available";
        }
      }
      
      current = current[part].children;
    }
  }
  
  // Convert to display format
  function convertToHierarchy(node: any): any {
    const children = Object.values(node.children || {})
      .map((child: any) => {
        const converted = {
          label: child.label,
          description: child.description
        };
        
        const grandchildren = convertToHierarchy(child);
        if (grandchildren.length > 0) {
          (converted as any).children = grandchildren;
        }
        
        return converted;
      });
    
    return children;
  }
  
  return Object.values(tree).map((node: any) => {
    const item = {
      label: node.label,
      description: node.description,
      icon: node.isLeaf ? ui.icons.play : ui.icons.folder
    };
    
    const children = convertToHierarchy(node);
    if (children.length > 0) {
      (item as any).children = children;
    }
    
    return item;
  });
}

function isVirtualExtension(ext: Extension): boolean {
  return ext.config?.runner === 'virtual' || ext.scriptPath === ext.command;
}

function isWrapperScript(ext: Extension): boolean {
  return ext.scriptPath.endsWith('.sh') && ext.scriptPath.includes('wrapper');
}

async function handleSetup(options: { showTutorial?: boolean } = {}) {
  console.log(ui.createHeader("🔧 Interactive Setup", "Let's get your rc CLI configured"));

  const setupWizard = new SetupWizard();
  
  try {
    // Run initial setup and get user preferences
    const setupOptions = await setupWizard.run();
    console.log('🔍 Setup options received:', setupOptions);
    
    // Perform the actual setup tasks based on user preferences
    if (setupOptions.setupXDG) {
      console.log('🏗️ Setting up XDG directories...');
      await performXDGSetup();
    }
    
    if (setupOptions.createConfig) {
      console.log('📝 Creating config file...');
      await createConfigFile(setupOptions);
    }
    
    if (setupOptions.createExamples) {
      console.log('🎯 Creating example extensions...');
      await createExampleExtensions();
    }
    
    console.log("\n" + ui.createBox([
        "✅ Configuration created successfully!",
        "📁 Extensions directory configured",
        "🎯 Example extensions created for learning",
        "",
        "You can now:",
        "• Run 'rc help' to see all available commands",
        "• Create your own extensions in the configured directory",
        "• Use 'rc doctor' to diagnose any issues",
        "",
        "Configuration details:",
        "You can edit the config file to customize rc's behavior.",
        "The config includes detailed comments and examples.",
        "",
        "🔗 To enable dynamic aliasing, add this to your shell config:",
        "   eval \"$(rc alias-init)\"",
        "",
        "This will create aliases for directories with 'aliasable: true' in their YAML config."
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
        const extCommands = extensions.map(ext => ({ command: ext.command, description: ext.config?.description || '' }));
        await setupWizard.runAliasWizard(extCommands);
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

async function handleQuickSetup() {
  console.log(ui.createHeader("🔧 Quick Setup", "Setting up Rodrigo's CLI with default options"));

  try {
    // Perform setup with default options (non-interactive)
    const setupOptions = {
      setupXDG: true,
      createConfig: true,
      createExamples: true,
      showTutorial: false
    };

    console.log('🏗️ Setting up XDG directories...');
    await performXDGSetup();
    
    console.log('📝 Creating config file...');
    await createConfigFile(setupOptions);
    
    console.log('🎯 Creating example extensions...');
    await createExampleExtensions();
    
    console.log("\n" + ui.createBox([
        "✅ Quick setup completed successfully!",
        "📁 Extensions directory created with examples",
        "⚙️ Configuration file created with defaults",
        "",
        "You can now:",
        "• Run 'rc help' to see all available commands", 
        "• Run 'rc hello' to test the hello command",
        "• Run 'rc gen uuid' to generate a UUID",
        "• Create your own extensions in ~/.local/share/rc/extensions",
        "",
        "For more options, run 'rc --setup' for the interactive wizard."
      ].join("\n"),
      { title: "🎉 Setup Complete", borderColor: "green" }
    ));

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
  const extensionsDirs = configManager.getExtensionsDirs();
  const settingsInfo = [
    { 
      label: "Extensions Directories", 
      value: `${extensionsDirs.length} configured`,
      status: extensionsDirs.length > 0 ? 'success' as const : 'error' as const
    },
    { label: "Default Runner", value: config.defaultRunner || "node" },
    { label: "Logging Enabled", value: config.enableLogging ? "Yes" : "No" },
    { 
      label: "Dark Mode", 
      value: config.darkMode === undefined ? "Auto-detect" : config.darkMode ? "Forced Dark" : "Forced Light" 
    }
  ];

  // Add individual directories to settings
  for (let i = 0; i < extensionsDirs.length; i++) {
    const dir = extensionsDirs[i];
    if (dir) {
      settingsInfo.push({
        label: `Directory ${i + 1} (Priority ${i + 1})`,
        value: dir,
        status: existsSync(dir) ? 'success' as const : 'error' as const
      });
    }
  }

  console.log(ui.createInfoPanel("⚙️ Current Settings", settingsInfo));
  console.log("");

  // Extensions summary
  try {
    const extensions = await extensionLoader.loadExtensions();
    const extensionsInfo = [
      { label: "Total Extensions", value: extensions.length.toString(), status: 'success' as const },
      { label: "Unique Scripts", value: new Set(extensions.map(e => e.scriptPath)).size.toString(), status: 'success' as const }
    ];

    // Count by type
    const typeCount = extensions.reduce((acc, ext) => {
      acc[ext.scriptType] = (acc[ext.scriptType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [type, count] of Object.entries(typeCount)) {
      extensionsInfo.push({
        label: `${type.toUpperCase()} files`,
        value: count.toString(),
        status: 'success' as const
      });
    }

    console.log(ui.createInfoPanel("📦 Extensions Status", extensionsInfo));
    console.log("");

    // Aliases info
    const aliasableDirectories: string[] = [];
    
    const directoryMap = new Map<string, Extension[]>();
    for (const ext of extensions) {
      if (ext.command.includes(' ')) {
        const [dirName] = ext.command.split(' ');
        if (dirName) {
          if (!directoryMap.has(dirName)) {
            directoryMap.set(dirName, []);
          }
          directoryMap.get(dirName)!.push(ext);
        }
      }
    }
    
    for (const [dirName, dirCommands] of directoryMap) {
      const firstCommand = dirCommands[0];
      if (!firstCommand) continue;
      const dirPath = dirname(firstCommand.scriptPath);
      const configPath = join(dirPath, `${dirName}.yaml`);
      
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf8');
          if (configContent.includes('aliasable: true')) {
            aliasableDirectories.push(dirName);
          }
        } catch (error) {
          // Skip directories with unreadable configs
        }
      }
    }

    const aliasesInfo = [
      { 
        label: "Aliasable Directories", 
        value: aliasableDirectories.length.toString(),
        status: aliasableDirectories.length > 0 ? 'success' as const : 'success' as const
      }
    ];

    if (aliasableDirectories.length > 0) {
      aliasesInfo.push({
        label: "Available for aliasing",
        value: aliasableDirectories.join(', '),
        status: 'success' as const
      });
    }

    console.log(ui.createInfoPanel("🔗 Aliases Configuration", aliasesInfo));
    console.log("");

  } catch (error) {
    console.log(ui.error("Failed to load extensions", error instanceof Error ? error.message : String(error)));
  }

  // Help text - emphasize alias setup if not configured
  const configHelp: string[] = [];
  
  if (!isAliasingEnabled()) {
    configHelp.push("🚀 SETUP ALIASES: Run 'eval \"$(rc alias-init)\"' to enable direct command shortcuts!");
    configHelp.push("");
  }
  
  configHelp.push(
    "Edit the configuration file to customize rc behavior",
    "Add more extension directories for broader command discovery",
    "Use 'rc doctor' to diagnose configuration issues",
    "Run 'rc --setup' to reconfigure interactively"
  );

  console.log(ui.createBox(
    configHelp.map(tip => tip === "" ? "" : `${ui.icons.bullet} ${tip === configHelp[0] && !isAliasingEnabled() ? tip : ui.format.muted(tip)}`).join("\n"),
    { title: "💡 Configuration Tips", borderColor: isAliasingEnabled() ? "yellow" : "red", dimBorder: !isAliasingEnabled() }
  ));
  
  console.log("");
}

async function handleUpdate() {
  console.log(themeChalk.header("\n🔄 Updating Rodrigo's CLI...\n"));

  try {
    const config = configManager.getConfig();
    const currentScriptPath = process.argv[1];
    
    if (!currentScriptPath) {
      console.log(themeChalk.statusError("   ❌ Could not determine script path"));
      return;
    }
    
    // Determine source repository location
    let sourceRepo: string;
    
    if (config.sourceRepo) {
      // Use configured source repo
      sourceRepo = config.sourceRepo;
      console.log(themeChalk.section("📁 Using configured source:"));
      console.log(themeChalk.textMuted(`   ${sourceRepo}`));
    } else if (currentScriptPath.includes('src/bin') && existsSync(join(dirname(dirname(dirname(currentScriptPath))), '.git'))) {
      // Running from source in development
      sourceRepo = dirname(dirname(dirname(currentScriptPath)));
      console.log(themeChalk.section("📁 Running from source:"));
      console.log(themeChalk.textMuted(`   ${sourceRepo}`));
    } else {
      // Use XDG-compliant default location
      sourceRepo = XDGPaths.getSourceRepoDir();
      console.log(themeChalk.section("📁 Using default source location:"));
      console.log(themeChalk.textMuted(`   ${sourceRepo}`));
    }
    
    // Check if source repo exists and is a git repo
    const isGitRepo = existsSync(join(sourceRepo, '.git'));
    
    if (!existsSync(sourceRepo) || !isGitRepo) {
      // Clone the repository
      console.log(themeChalk.section("\n📥 Setting up source repository..."));
      
      if (!existsSync(sourceRepo)) {
        console.log(themeChalk.textMuted("   📁 Creating directory..."));
        execSync(`mkdir -p "${dirname(sourceRepo)}"`, { stdio: 'pipe' });
      }
      
      console.log(themeChalk.textMuted("   📥 Cloning repository..."));
      execSync(`git clone https://github.com/rodrigopsasaki/rodrigos-cli.git "${sourceRepo}"`, { 
        stdio: 'pipe' 
      });
    }
    
    // Update the source repository
    console.log(themeChalk.section("\n📥 Updating source..."));
    
    // Check for uncommitted changes if running from source
    if (currentScriptPath.includes('src/bin') && sourceRepo === dirname(dirname(dirname(currentScriptPath)))) {
      const status = execSync('git status --porcelain', { 
        cwd: sourceRepo, 
        encoding: 'utf8' 
      }).trim();
      
      if (status) {
        console.log(themeChalk.statusError("   ❌ Uncommitted changes detected"));
        console.log(themeChalk.textMuted("   💡 Please commit or stash your changes before updating"));
        return;
      }
    }
    
    // Get current version
    let currentVersion = 'unknown';
    const currentPackageJsonPath = join(sourceRepo, 'package.json');
    if (existsSync(currentPackageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(currentPackageJsonPath, 'utf8'));
        currentVersion = packageJson.version || 'unknown';
      } catch (error) {
        // Ignore
      }
    }
    
    // Fetch and pull latest changes
    console.log(themeChalk.textMuted("   📥 Fetching latest changes..."));
    execSync('git fetch origin', { cwd: sourceRepo, stdio: 'pipe' });
    
    const localCommit = execSync('git rev-parse HEAD', { 
      cwd: sourceRepo, 
      encoding: 'utf8' 
    }).trim();
    
    const remoteCommit = execSync('git rev-parse origin/main', { 
      cwd: sourceRepo, 
      encoding: 'utf8' 
    }).trim();
    
    if (localCommit === remoteCommit) {
      console.log(themeChalk.status("   ✅ Already up to date!"));
      console.log(themeChalk.textMuted(`   📦 Version: ${currentVersion}`));
      return;
    }
    
    // Show what will be updated
    console.log(themeChalk.section("\n📋 Updates available:"));
    const commits = execSync('git log --oneline HEAD..origin/main', { 
      cwd: sourceRepo, 
      encoding: 'utf8' 
    }).trim();
    
    if (commits) {
      console.log(themeChalk.textMuted(commits.split('\n').map(line => `   ${line}`).join('\n')));
    }
    
    // Pull the changes
    console.log(themeChalk.textMuted("\n   📥 Pulling latest changes..."));
    execSync('git pull origin main', { cwd: sourceRepo, stdio: 'pipe' });
    
    // Install dependencies and build
    console.log(themeChalk.section("\n🔨 Building..."));
    
    console.log(themeChalk.textMuted("   📦 Installing dependencies..."));
    execSync('npm install --no-audit --no-fund', { cwd: sourceRepo, stdio: 'pipe' });
    
    console.log(themeChalk.textMuted("   🔨 Building project..."));
    execSync('npm run build', { cwd: sourceRepo, stdio: 'pipe' });
    
    // Get new version
    let newVersion = 'unknown';
    try {
      const packageJson = JSON.parse(readFileSync(currentPackageJsonPath, 'utf8'));
      newVersion = packageJson.version || 'unknown';
    } catch (error) {
      // Ignore
    }
    
    // Find installation directory if needed
    let needsInstallUpdate = false;
    let installationDir: string | null = null;
    
    if (!currentScriptPath.includes('src/bin')) {
      // Not running from source, need to update installation
      if (currentScriptPath.includes('.local/bin')) {
        installationDir = join(dirname(currentScriptPath), 'rodrigos-cli');
      } else {
        const possiblePaths = [
          join(process.env['HOME'] || '', '.local/bin/rodrigos-cli'),
          '/usr/local/bin/rodrigos-cli',
          '/opt/rodrigos-cli'
        ];
        installationDir = possiblePaths.find(path => existsSync(path)) || null;
      }
      
      if (installationDir && existsSync(installationDir)) {
        needsInstallUpdate = true;
      }
    }
    
    if (needsInstallUpdate && installationDir) {
      console.log(themeChalk.section("\n🔄 Updating installation..."));
      console.log(themeChalk.textMuted(`   📁 ${installationDir}`));
      
      // Remove old files
      execSync(`rm -rf "${installationDir}/dist" "${installationDir}/src" "${installationDir}/node_modules"`, { 
        stdio: 'pipe' 
      });
      
      // Copy new files
      execSync(`cp -r "${sourceRepo}/dist" "${installationDir}/"`, { stdio: 'pipe' });
      execSync(`cp -r "${sourceRepo}/src" "${installationDir}/"`, { stdio: 'pipe' });
      execSync(`cp -r "${sourceRepo}/node_modules" "${installationDir}/"`, { stdio: 'pipe' });
      execSync(`cp "${sourceRepo}/package.json" "${installationDir}/"`, { stdio: 'pipe' });
      execSync(`cp "${sourceRepo}/tsconfig.json" "${installationDir}/" 2>/dev/null || true`, { stdio: 'pipe' });
      
      // Make scripts executable
      execSync(`chmod +x "${installationDir}/dist/bin/rc.js" "${installationDir}/dist/bin/rc-immutable.js" 2>/dev/null || true`, { 
        stdio: 'pipe' 
      });
    }
    
    console.log(themeChalk.status("\n   ✅ Update completed successfully!"));
    console.log(themeChalk.textMuted(`   📦 Version: ${currentVersion} → ${newVersion}`));
    
    if (!config.sourceRepo && sourceRepo === XDGPaths.getSourceRepoDir()) {
      console.log(themeChalk.textMuted(`\n   💡 Tip: Source repository stored at ${sourceRepo}`));
      console.log(themeChalk.textMuted(`   💡 Add 'sourceRepo: /path/to/your/fork' to config for custom location`));
    }
    
  } catch (error) {
    console.error(themeChalk.statusError("   ❌ Update failed:"), error);
    console.log(themeChalk.textMuted("   💡 Check your internet connection and try again"));
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
      let matchingExtension = extensions.find(ext => ext.command === fullCommand);
      
      // If no exact match, check if it's a directory-level command
      if (!matchingExtension) {
        const directoryCommands = extensions.filter(ext => ext.command.startsWith(`${fullCommand} `));
        if (directoryCommands.length > 0) {
          // Create a virtual extension for directory aliasing
          matchingExtension = {
            command: fullCommand,
            scriptPath: fullCommand, // This will trigger directory command detection
            scriptType: 'virtual',
            config: {
              description: `Directory commands for ${fullCommand}`,
              runner: 'virtual',
              passContext: false
            }
          } as Extension;
        }
      }
      
      if (!matchingExtension) {
        // Check if this might be a directory we should create
        const extensionsDirs = configManager.getExtensionsDirs();
        let potentialDir: string | null = null;
        
        // For nested commands like "cbh npm", try to find the parent directory
        if (commandArgs.length > 1) {
          const parentCommand = commandArgs.slice(0, -1).join('/');
          for (const baseDir of extensionsDirs) {
            const candidateDir = join(baseDir, parentCommand);
            if (existsSync(candidateDir)) {
              potentialDir = candidateDir;
              break;
            }
          }
        } else {
          // For single commands like "cbh", try to find it in extensions directories
          for (const baseDir of extensionsDirs) {
            const candidateDir = join(baseDir, fullCommand);
            if (existsSync(candidateDir)) {
              potentialDir = candidateDir;
              break;
            }
          }
        }
        
        if (potentialDir) {
          // Create a virtual extension for this directory
          matchingExtension = {
            command: fullCommand,
            scriptPath: potentialDir,
            scriptType: 'virtual',
            config: {
              description: `Directory commands for ${fullCommand}`,
              runner: 'virtual',
              passContext: false
            }
          } as Extension;
        } else {
          console.error(themeChalk.statusError(`❌ Command "rc ${fullCommand}" not found and no directory exists`));
          console.log(themeChalk.textMuted('Available commands:'));
          for (const ext of extensions.slice(0, 5)) {
            console.log(themeChalk.textMuted(`   rc ${ext.command}`));
          }
          if (extensions.length > 5) {
            console.log(themeChalk.textMuted(`   ... and ${extensions.length - 5} more`));
          }
          console.log(themeChalk.textMuted(`\nTo create a directory-based alias, ensure the directory exists first.`));
          process.exit(1);
        }
      }

      // Get rc binary path
      const rcBinaryPath = process.argv[1];
      if (!rcBinaryPath) {
        console.error(themeChalk.statusError('Could not determine rc binary path'));
        process.exit(1);
        return; // This satisfies TypeScript's control flow analysis
      }

      // Check if this is a directory-level command (virtual extension)
      if (matchingExtension) {
        const isDirectoryCommand = matchingExtension.scriptPath === aliasName || (matchingExtension.scriptPath.endsWith(aliasName as string) && !matchingExtension.scriptPath.includes('.'));
        if (isDirectoryCommand) {
          // Create directory-level alias - generate wrapper script
          await createDirectoryAlias(aliasName as string, extensions, rcBinaryPath, fullCommand);
          return;
        }
      }

      // Create symlink for individual commands
      
      const aliasPath = join(dirname(rcBinaryPath), aliasName as string);
      
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

// Alias-init command - generates shell aliases based on directory configs
program
  .command("alias-init")
  .description("Generate shell aliases for all aliasable directories")
  .action(async () => {
    await handleAliasInit();
  });

// Doctor command
program
  .command("doctor")
  .description("Diagnose configuration and identify extension conflicts")
  .action(async () => {
    await handleDoctor();
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

// Removed buildCommandTree and printCommandTree functions as they're no longer used

function buildHierarchicalItemsFromCommandMap(commandData: Array<{ command: string; description: string; type: string; aliases: string[] }>): Array<{ 
  label: string; 
  children?: Array<{ label: string; description?: string }>;
  description?: string;
  icon?: string;
}> {
  const tree: Record<string, any> = {};
  
  // Build tree structure from command data (already filtered and grouped)
  for (const cmd of commandData) {
    const parts = cmd.command.split(" ");
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      if (!current[part]) {
        current[part] = {
          label: part,
          children: {},
          isLeaf: i === parts.length - 1
        };
        
        // Add description only for leaf nodes (actual commands)
        if (i === parts.length - 1) {
          current[part].description = cmd.description;
        }
      }
      
      current = current[part].children;
    }
  }
  
  // Convert to display format
  function convertToHierarchy(node: any): any {
    return Object.values(node.children || {})
      .map((child: any) => {
        const converted = {
          label: child.label,
          description: child.description
        };
        
        const grandchildren = convertToHierarchy(child);
        if (grandchildren.length > 0) {
          (converted as any).children = grandchildren;
        }
        
        return converted;
      });
  }
  
  return Object.values(tree).map((node: any) => {
    const item = {
      label: node.label,
      description: node.description,
      icon: node.isLeaf ? ui.icons.play : ui.icons.folder
    };
    
    const children = convertToHierarchy(node);
    if (children.length > 0) {
      (item as any).children = children;
    }
    
    return item;
  });
}

async function handleDoctor() {
  console.log(ui.createHeader("🩺 System Diagnosis", "Analyzing rc configuration and potential issues"));

  const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; solution?: string }> = [];
  const successes: string[] = [];

  try {
    const configPath = configManager.getConfigPath();
    
    // Check config file
    if (existsSync(configPath)) {
      successes.push("Configuration file found");
    } else {
      issues.push({
        type: 'error',
        message: "Configuration file missing",
        solution: "Run 'rc --setup' to create a configuration file"
      });
    }

    // Check extensions directories
    const extensionsDirs = configManager.getExtensionsDirs();
    if (extensionsDirs.length === 0) {
      issues.push({
        type: 'error',
        message: "No extension directories configured",
        solution: "Run 'rc --setup' to configure extension directories"
      });
    } else {
      for (const dir of extensionsDirs) {
        if (existsSync(dir)) {
          successes.push(`Extension directory exists: ${dir}`);
        } else {
          issues.push({
            type: 'warning',
            message: `Extension directory not found: ${dir}`,
            solution: `Create the directory: mkdir -p "${dir}"`
          });
        }
      }
    }

    // Load and analyze extensions
    try {
      const extensions = await extensionLoader.loadExtensions();
      
      if (extensions.length === 0) {
        issues.push({
          type: 'warning',
          message: "No extensions found",
          solution: "Create some extension scripts in your configured directories"
        });
      } else {
        successes.push(`Found ${extensions.length} extensions`);

        // Check for duplicate commands
        const commandCounts = new Map<string, Extension[]>();
        for (const ext of extensions) {
          if (!commandCounts.has(ext.command)) {
            commandCounts.set(ext.command, []);
          }
          commandCounts.get(ext.command)!.push(ext);
        }

        for (const [command, exts] of commandCounts) {
          if (exts.length > 1) {
            issues.push({
              type: 'warning',
              message: `Duplicate command "${command}" found in ${exts.length} files`,
              solution: `Check: ${exts.map(e => e.scriptPath).join(', ')}`
            });
          }
        }

        // Check for script execution permissions
        const scriptFiles = [...new Set(extensions.map(e => e.scriptPath))];
        for (const scriptPath of scriptFiles) {
          if (existsSync(scriptPath)) {
            try {
              const stats = statSync(scriptPath);
              if (!(stats.mode & 0o111)) {
                issues.push({
                  type: 'warning',
                  message: `Script not executable: ${scriptPath}`,
                  solution: `Make executable: chmod +x "${scriptPath}"`
                });
              }
            } catch (error) {
              issues.push({
                type: 'error',
                message: `Cannot check permissions for: ${scriptPath}`,
                solution: "Verify the file exists and is accessible"
              });
            }
          } else {
            issues.push({
              type: 'error',
              message: `Script file not found: ${scriptPath}`,
              solution: "Verify the file path is correct"
            });
          }
        }
      }
    } catch (error) {
      issues.push({
        type: 'error',
        message: `Failed to load extensions: ${error instanceof Error ? error.message : String(error)}`,
        solution: "Check extension directory permissions and script syntax"
      });
    }

    // Display results
    if (successes.length > 0) {
      console.log(ui.createBox(
        successes.map(success => `${ui.icons.success} ${success}`).join("\n"),
        { title: "✅ Working Correctly", borderColor: "green" }
      ));
      console.log("");
    }

    if (issues.length > 0) {
      const errorIssues = issues.filter(i => i.type === 'error');
      const warningIssues = issues.filter(i => i.type === 'warning');
      const infoIssues = issues.filter(i => i.type === 'info');

      if (errorIssues.length > 0) {
        console.log(ui.createBox(
          errorIssues.map(issue => {
            let text = `${ui.icons.error} ${issue.message}`;
            if (issue.solution) {
              text += `\n  ${ui.format.muted('Solution:')} ${issue.solution}`;
            }
            return text;
          }).join("\n\n"),
          { title: "❌ Errors", borderColor: "red" }
        ));
        console.log("");
      }

      if (warningIssues.length > 0) {
        console.log(ui.createBox(
          warningIssues.map(issue => {
            let text = `${ui.icons.warning} ${issue.message}`;
            if (issue.solution) {
              text += `\n  ${ui.format.muted('Solution:')} ${issue.solution}`;
            }
            return text;
          }).join("\n\n"),
          { title: "⚠️ Warnings", borderColor: "yellow" }
        ));
        console.log("");
      }

      if (infoIssues.length > 0) {
        console.log(ui.createBox(
          infoIssues.map(issue => {
            let text = `${ui.icons.info} ${issue.message}`;
            if (issue.solution) {
              text += `\n  ${ui.format.muted('Suggestion:')} ${issue.solution}`;
            }
            return text;
          }).join("\n\n"),
          { title: "ℹ️ Information", borderColor: "blue" }
        ));
        console.log("");
      }
    }

    // Summary
    const summary = [
      `Total issues found: ${issues.length}`,
      `- Errors: ${issues.filter(i => i.type === 'error').length}`,
      `- Warnings: ${issues.filter(i => i.type === 'warning').length}`,
      `- Info: ${issues.filter(i => i.type === 'info').length}`
    ];

    const summaryColor = issues.filter(i => i.type === 'error').length > 0 ? 'red' : 
                        issues.filter(i => i.type === 'warning').length > 0 ? 'yellow' : 'green';

    console.log(ui.createBox(
      summary.join("\n"),
      { title: "📊 Diagnosis Summary", borderColor: summaryColor, dimBorder: true }
    ));

  } catch (error) {
    console.error(themeChalk.statusError("Doctor check failed:"), error);
    process.exit(1);
  }
}

async function handleAliasedExecution(commandArgs: string[]): Promise<void> {
  const configManager = new ConfigManager();
  const extensionLoader = new ExtensionLoader(configManager);
  
  try {
    const extensions = await extensionLoader.loadExtensions();
    const fullCommand = commandArgs.join(' ');
    
    // Try to find exact match first
    let matchingExtension = extensions.find(ext => ext.command === fullCommand);
    
    if (!matchingExtension) {
      // Try to find the longest matching command
      const possibleMatches = extensions.filter(ext => 
        ext.command.startsWith(commandArgs[0] + ' ') || ext.command === commandArgs[0]
      );
      
      if (possibleMatches.length === 0) {
        console.error(themeChalk.statusError(`❌ No command starting with "${commandArgs[0]}" found`));
        process.exit(1);
      }
      
      // Find the best match by trying progressively longer command paths
      for (let i = commandArgs.length; i >= 1; i--) {
        const partialCommand = commandArgs.slice(0, i).join(' ');
        const match = possibleMatches.find(ext => ext.command === partialCommand);
        if (match) {
          matchingExtension = match;
          break;
        }
      }
      
      if (!matchingExtension) {
        console.error(themeChalk.statusError(`❌ No exact command match found for "${fullCommand}"`));
        console.log(themeChalk.textMuted('Available commands starting with "' + commandArgs[0] + '":'));
        for (const ext of possibleMatches.slice(0, 10)) {
          console.log(themeChalk.textMuted(`   rc ${ext.command}`));
        }
        process.exit(1);
      }
    }
    
    // Found exactly one match - execute it with additional arguments
    const extension = matchingExtension;
    if (!extension) {
      console.error(themeChalk.statusError('Extension not found'));
      process.exit(1);
    }

    // Calculate remaining arguments that weren't part of the matched command
    const commandParts = extension.command.split(' ');
    const remainingArgs = commandArgs.slice(commandParts.length);
    
    // Prepare execution options with remaining arguments
    const options = {
      verbose: process.argv.includes('--verbose'),
      passContext: extension.config?.passContext || false,
      args: remainingArgs
    };

    // Execute the extension
    await extensionLoader.executeExtension(extension, options);
    process.exit(0);
    
  } catch (error) {
    console.error(themeChalk.statusError('Error executing aliased command:'), error);
    process.exit(1);
  }
}

// Create directory-level alias that routes commands intelligently
async function createDirectoryAlias(aliasName: string, extensions: Extension[], rcBinaryPath: string, fullCommand?: string): Promise<void> {
  const targetCommand = fullCommand || aliasName;
  
  // Find all commands that start with this directory name
  const directoryCommands = extensions.filter(ext => 
    ext.command.startsWith(`${targetCommand} `) || ext.command === targetCommand
  );

  // If no commands found but we have a directory, scan it for scripts
  if (directoryCommands.length === 0) {
    // Try to find the directory and scan for scripts
    const extensionsDirs = configManager.getExtensionsDirs();
    let foundDir: string | null = null;
    
    if (targetCommand.includes(' ')) {
      // For nested commands like "cbh npm", look for parent/child structure
      const parts = targetCommand.split(' ');
      for (const baseDir of extensionsDirs) {
        const candidateDir = join(baseDir, ...parts);
        if (existsSync(candidateDir)) {
          foundDir = candidateDir;
          break;
        }
      }
    } else {
      // For single commands like "cbh", look directly
      for (const baseDir of extensionsDirs) {
        const candidateDir = join(baseDir, targetCommand);
        if (existsSync(candidateDir)) {
          foundDir = candidateDir;
          break;
        }
      }
    }
    
    if (!foundDir) {
      console.error(themeChalk.statusError(`❌ No commands found for "${targetCommand}" and directory doesn't exist`));
      return;
    }
    
    // Directory exists but no commands discovered yet - this is fine, we'll create the wrapper anyway
    console.log(themeChalk.textMuted(`📁 Found directory: ${foundDir}`));
    console.log(themeChalk.textMuted(`   Creating wrapper for future commands...`));
  }

  // Find the directory-level extension (virtual extension for the directory itself)
  let directoryExtension = directoryCommands.find(ext => ext.command === targetCommand);
  
  // If no directory-level extension, create one from the first subcommand or found directory
  if (!directoryExtension) {
    let extensionDir: string;
    
    if (directoryCommands.length > 0) {
      // Determine directory based on target command depth
      const firstSubcommand = directoryCommands[0];
      if (!firstSubcommand) {
        console.error(themeChalk.statusError('No valid subcommand found'));
        return;
      }
      
      // Calculate how many levels up we need to go based on the target command
      const targetParts = targetCommand.split(' ');
      const scriptDir = dirname(firstSubcommand.scriptPath);
      
      // For "cbh" with subcommand in "cbh/npm/script.sh", we want "cbh/" directory
      // For "cbh npm" with subcommand in "cbh/npm/script.sh", we want "cbh/npm/" directory
      const scriptDirParts = scriptDir.split('/');
      const extensionsDirs = configManager.getExtensionsDirs();
      
      // Find the base extensions directory
      let baseIndex = -1;
      for (const baseDir of extensionsDirs) {
        const baseParts = baseDir.split('/');
        if (scriptDirParts.slice(0, baseParts.length).join('/') === baseDir) {
          baseIndex = baseParts.length;
          break;
        }
      }
      
      if (baseIndex === -1) {
        console.error(themeChalk.statusError('Could not determine base extensions directory'));
        return;
      }
      
      // Build the correct directory path: base + target command parts
      const basePath = scriptDirParts.slice(0, baseIndex).join('/');
      extensionDir = join(basePath, ...targetParts);
    } else {
      // No commands found but directory exists - use the found directory from earlier scan
      const extensionsDirs = configManager.getExtensionsDirs();
      let foundDir: string | null = null;
      
      if (targetCommand.includes(' ')) {
        const parts = targetCommand.split(' ');
        for (const baseDir of extensionsDirs) {
          const candidateDir = join(baseDir, ...parts);
          if (existsSync(candidateDir)) {
            foundDir = candidateDir;
            break;
          }
        }
      } else {
        for (const baseDir of extensionsDirs) {
          const candidateDir = join(baseDir, targetCommand);
          if (existsSync(candidateDir)) {
            foundDir = candidateDir;
            break;
          }
        }
      }
      
      if (!foundDir) {
        console.error(themeChalk.statusError('No directory found'));
        return;
      }
      extensionDir = foundDir;
    }
    
    directoryExtension = {
      command: targetCommand,
      scriptPath: extensionDir,
      scriptType: 'virtual',
      config: {
        description: `Directory commands for ${targetCommand}`,
        runner: 'virtual',
        passContext: false
      }
    } as Extension;
  }
  
  if (!directoryExtension) {
    console.error(themeChalk.statusError('No directory-level extension found'));
    return;
  }

  // Use the directory path
  const extensionDir = directoryExtension.scriptPath;
  const wrapperPath = join(extensionDir, `${aliasName}.sh`);
  const yamlPath = join(extensionDir, `${aliasName}.yaml`);

  // When explicitly calling `rc alias`, always create the wrapper regardless of aliasable config
  
  // Ensure YAML config exists
  if (!existsSync(yamlPath)) {
    const yamlContent = `description: ${aliasName} wrapper that routes custom commands to rc, others to system ${aliasName}
aliasable: true
runner: bash
`;
    writeFileSync(yamlPath, yamlContent);
    console.log(themeChalk.status(`📝 Created config file: ${yamlPath}`));
  }

  // Get available subcommands
  const availableCommands = directoryCommands
    .map(ext => ext.command.replace(`${targetCommand} `, ''))
    .filter(cmd => cmd !== targetCommand);

  // Create bash wrapper script that routes commands
  const wrapperScript = `#!/bin/bash

# ${aliasName} wrapper - routes custom commands to rc, others to system ${aliasName}
# Generated by rc alias ${targetCommand}

# Get the command being called
SUBCOMMAND="$1"

# Available custom commands
CUSTOM_COMMANDS=(${availableCommands.map(cmd => `"${cmd}"`).join(' ')})

# Check if this is a custom command
is_custom_command() {
  local full_args="$*"
  for cmd in "\${CUSTOM_COMMANDS[@]}"; do
    if [[ "$full_args" == "$cmd" ]]; then
      return 0
    fi
  done
  return 1
}

# Route the command
if [[ $# -eq 0 ]] || is_custom_command "$@"; then
  # Route to rc
  exec "${rcBinaryPath}" ${targetCommand} "$@"
else
  # Find real ${aliasName} in PATH (excluding this script)
  REAL_COMMAND=$(PATH=\${PATH//${extensionDir}:/} which ${aliasName} 2>/dev/null)
  
  if [[ -n "$REAL_COMMAND" && "$REAL_COMMAND" != "${wrapperPath}" ]]; then
    # Route to real ${aliasName}
    exec "$REAL_COMMAND" "$@"
  else
    echo "❌ Command '${aliasName} $SUBCOMMAND' not found"
    echo "Available custom commands:"
${availableCommands.map(cmd => `    echo "   ${targetCommand} ${cmd}"`).join('\n')}
    echo ""
    echo "Or install ${aliasName} to use standard commands"
    exit 1
  fi
fi
`;

  // Write the wrapper script to the directory
  writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });
  
  console.log(themeChalk.status(`🔗 Created wrapper script: ${wrapperPath}`));
  console.log(themeChalk.textMuted(`   Custom commands:`));
  availableCommands.forEach(cmd => {
    console.log(themeChalk.textMuted(`     ${targetCommand} ${cmd}`));
  });
  console.log(themeChalk.textMuted(`   Other commands will be routed to system ${aliasName}`));
  console.log('');
  console.log(themeChalk.status(`✨ Wrapper created! Run 'eval "$(rc alias-init)"' to set up all aliases.`));
}

// Handle alias-init command - scan directories and output shell aliases
async function handleAliasInit(): Promise<void> {
  try {
    const extensions = await extensionLoader.loadExtensions();
    
    // Find all directories by grouping commands
    const directoryMap = new Map<string, Extension[]>();
    
    for (const ext of extensions) {
      if (ext.command.includes(' ')) {
        const commandParts = ext.command.split(' ');
        
        // Check all possible directory levels
        // For "cbh npm show-scripts", check both "cbh" and "cbh npm"
        for (let i = 1; i <= commandParts.length - 1; i++) {
          const dirName = commandParts.slice(0, i).join(' ');
          if (!directoryMap.has(dirName)) {
            directoryMap.set(dirName, []);
          }
          directoryMap.get(dirName)!.push(ext);
        }
      }
    }
    
    const aliasableDirectories: string[] = [];
    
    for (const [dirName, dirCommands] of directoryMap) {
      // Get directory path from first command in the directory
      const firstCommand = dirCommands[0];
      if (!firstCommand) continue;
      
      // Calculate the correct directory path based on dirName depth
      const dirParts = dirName.split(' ');
      const lastPart = dirParts[dirParts.length - 1];
      if (!lastPart || lastPart.length === 0) continue;
      
      // For "cbh npm", we want to look in the directory that corresponds to that level
      // For "cbh npm show-scripts" in /path/cbh/npm/show-scripts.sh
      // - dirName "cbh" should look in /path/cbh/ for cbh.yaml
      // - dirName "cbh npm" should look in /path/cbh/npm/ for npm.yaml
      const extensionsDirs = configManager.getExtensionsDirs();
      let targetDir: string | undefined;
      
      for (const baseDir of extensionsDirs) {
        const candidateDir = join(baseDir, ...dirParts);
        if (existsSync(candidateDir)) {
          targetDir = candidateDir;
          break;
        }
      }
      
      if (!targetDir) continue;
      
      const configPath = join(targetDir, `${lastPart}.yaml`);
      
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf8');
          if (configContent.includes('aliasable: true')) {
            const wrapperPath = join(targetDir, `${lastPart}.sh`);
            
            // Ensure wrapper exists, create if needed
            if (!existsSync(wrapperPath)) {
              await createDirectoryWrapper(lastPart, extensions);
            }
            
            // Output alias command - use the last part as the alias name
            console.log(`alias ${lastPart}='${wrapperPath}'`);
            aliasableDirectories.push(lastPart);
          }
        } catch (error) {
          // Skip directories with unreadable configs
        }
      }
    }
    
    if (aliasableDirectories.length === 0) {
      console.error(`# No aliasable directories found. Add 'aliasable: true' to directory YAML configs.`);
    } else {
      // Set environment variable to indicate aliases are configured
      console.log(`export RC_ALIASING_ENABLED=1`);
    }
    
  } catch (error) {
    console.error(`# Error generating aliases: ${error}`);
  }
}

// Create wrapper script for a directory (used by both alias and alias-init)
async function createDirectoryWrapper(aliasName: string, extensions: Extension[]): Promise<void> {
  const directoryCommands = extensions.filter(ext => 
    ext.command.startsWith(`${aliasName} `) || ext.command === aliasName
  );

  const directoryExtension = directoryCommands.find(ext => ext.command === aliasName);
  if (!directoryExtension) return;

  const extensionDir = directoryExtension.scriptPath;
  const wrapperPath = join(extensionDir, `${aliasName}.sh`);
  
  const availableCommands = directoryCommands
    .map(ext => ext.command.replace(`${aliasName} `, ''))
    .filter(cmd => cmd !== aliasName);

  const rcBinaryPath = process.argv[1] || '/usr/local/bin/rc';

  const wrapperScript = `#!/bin/bash

# ${aliasName} wrapper - routes custom commands to rc, others to system ${aliasName}
# Generated by rc alias-init

# Get the command being called
SUBCOMMAND="$1"

# Available custom commands
CUSTOM_COMMANDS=(${availableCommands.map(cmd => `"${cmd}"`).join(' ')})

# Check if this is a custom command
is_custom_command() {
  local full_args="$*"
  for cmd in "\${CUSTOM_COMMANDS[@]}"; do
    if [[ "$full_args" == "$cmd" ]]; then
      return 0
    fi
  done
  return 1
}

# Route the command
if [[ $# -eq 0 ]] || is_custom_command "$@"; then
  # Route to rc
  exec "${rcBinaryPath}" ${aliasName} "$@"
else
  # Find real ${aliasName} in PATH (excluding this script)
  REAL_COMMAND=$(PATH=\${PATH//${extensionDir}:/} which ${aliasName} 2>/dev/null)
  
  if [[ -n "$REAL_COMMAND" && "$REAL_COMMAND" != "${wrapperPath}" ]]; then
    # Route to real ${aliasName}
    exec "$REAL_COMMAND" "$@"
  else
    echo "❌ Command '${aliasName} $SUBCOMMAND' not found"
    echo "Available custom commands:"
${availableCommands.map(cmd => `    echo "   ${aliasName} ${cmd}"`).join('\n')}
    echo ""
    echo "Or install ${aliasName} to use standard commands"
    exit 1
  fi
fi
`;

  writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });
}

// Setup functions
async function performXDGSetup(): Promise<void> {
  const xdgPaths = XDGPaths.getAllAppDirs();
  
  // Only create directories, not files
  const directoriesToCreate = ['config', 'data', 'cache', 'state', 'extensions', 'sourceRepo'];
  
  // Create XDG directories
  for (const [dirType, dirPath] of Object.entries(xdgPaths)) {
    if (dirPath && directoriesToCreate.includes(dirType)) {
      const { mkdirSync } = await import('fs');
      try {
        mkdirSync(dirPath, { recursive: true });
        console.log(ui.info(`Created ${dirType} directory: ${dirPath}`));
      } catch (error) {
        console.log(ui.warning(`Directory already exists: ${dirPath}`));
      }
    }
  }
}

async function createConfigFile(setupOptions: any): Promise<void> {
  const configPath = configManager.getConfigPath();
  const extensionsDir = XDGPaths.getExtensionsDir();
  
  const config = {
    version: "1.0",
    extensionsDirs: [extensionsDir],
    defaultRunner: setupOptions.defaultRunner || "node",
    enableLogging: setupOptions.enableLogging || false,
    darkMode: setupOptions.darkMode === "auto" ? undefined : setupOptions.darkMode === "dark"
  };
  
  try {
    const { mkdirSync, writeFileSync } = await import('fs');
    const { dirname } = await import('path');
    
    // Ensure config directory exists
    mkdirSync(dirname(configPath), { recursive: true });
    
    // Write config file
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(ui.info(`Created configuration file: ${configPath}`));
  } catch (error) {
    console.log(ui.error("Failed to create config file", error instanceof Error ? error.message : String(error)));
  }
}

async function createExampleExtensions(): Promise<void> {
  const extensionsDir = XDGPaths.getExtensionsDir();
  const { mkdirSync, writeFileSync, existsSync } = await import('fs');
  const { join } = await import('path');
  
  try {
    // Ensure extensions directory exists
    mkdirSync(extensionsDir, { recursive: true });
    
    // Create gen directory for generator commands
    const genDir = join(extensionsDir, 'gen');
    mkdirSync(genDir, { recursive: true });
    
    // Create UUID generator script
    const uuidScript = join(genDir, 'uuid.sh');
    if (!existsSync(uuidScript)) {
      const uuidContent = `#!/bin/bash
# Generate a UUID
if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import uuid; print(uuid.uuid4())"
else
    echo "Error: Neither uuidgen nor python3 is available" >&2
    exit 1
fi
`;
      writeFileSync(uuidScript, uuidContent, { mode: 0o755 });
      
      // Create config file for uuid command
      const uuidConfig = join(genDir, 'uuid.yaml');
      const configContent = `description: Generate a UUID (Universally Unique Identifier)
runner: bash
aliases: []
`;
      writeFileSync(uuidConfig, configContent);
      console.log(ui.info(`Created example command: gen uuid`));
    }
    
    // Create a simple hello world script
    const helloScript = join(extensionsDir, 'hello.js');
    if (!existsSync(helloScript)) {
      const helloContent = `#!/usr/bin/env node
console.log('Hello from rc! 👋');
console.log('You can create your own commands by adding scripts to:', process.env.RC_EXTENSIONS_DIR || '${extensionsDir}');
`;
      writeFileSync(helloScript, helloContent, { mode: 0o755 });
      
      // Create config for hello command
      const helloConfig = join(extensionsDir, 'hello.yaml');
      const helloConfigContent = `description: Simple hello world example
runner: node
aliases: []
`;
      writeFileSync(helloConfig, helloConfigContent);
      console.log(ui.info(`Created example command: hello`));
    }
    
    console.log(ui.success(`Example extensions created in: ${extensionsDir}`));
    
  } catch (error) {
    console.log(ui.error("Failed to create example extensions", error instanceof Error ? error.message : String(error)));
  }
}