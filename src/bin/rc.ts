#!/usr/bin/env node

import { Command } from "commander";
import { existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { ExtensionLoader } from "../core/extension-loader.js";
import { ConfigManager } from "../core/config-manager.js";
import { DadJokeService } from "../utils/dad-joke-service.js";
import { CompletionService } from "../core/completion-service.js";
import { getVersion } from "../utils/version.js";
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
  .version(getVersion())
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
  const extensionsDirs = configManager.getExtensionsDirs();
  
  let extensions: any[] = [];
  let conflicts: any[] = [];
  try {
    extensions = await withProgress(
      "Loading extensions...",
      () => extensionLoader.loadExtensions(),
      { successText: "Extensions loaded" }
    );
    conflicts = extensionLoader.getConflicts();
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
      label: "Extensions directories", 
      value: `${extensionsDirs.length} configured`,
      status: extensionsDirs.length > 0 ? 'success' as const : 'error' as const
    },
    {
      label: "Primary directory",
      value: extensionsDirs[0] || "None",
      status: extensionsDirs[0] && existsSync(extensionsDirs[0]) ? 'success' as const : 'error' as const
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

  // Show conflicts warning if any exist
  if (conflicts.length > 0) {
    console.log(ui.createBox(
      ui.error("⚠️ Command Conflicts Detected", `${conflicts.length} command(s) have naming conflicts. Run 'rc doctor' for details.`),
      { title: "🚨 Warning", borderColor: "yellow" }
    ));
    console.log("");
  }

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
  
  console.log(ui.createInfoPanel("🔧 Current Settings", settingsInfo));
  console.log("");

  // Load extensions for aliasing and extension info
  const extensions = await withProgress(
    "Loading extensions...",
    () => extensionLoader.loadExtensions()
  );

  // Aliasing info
  const aliasableDirectories = extensions.filter(ext => {
    // Check for directory-level extensions with aliasable config
    if (!ext.command.includes(' ') && ext.scriptPath.endsWith(ext.command)) {
      const configPath = join(ext.scriptPath, `${ext.command}.yaml`);
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf8');
          return configContent.includes('aliasable: true');
        } catch {
          return false;
        }
      }
    }
    return false;
  });

  if (aliasableDirectories.length > 0) {
    const aliasInfo = aliasableDirectories.map(ext => ({
      label: ext.command,
      value: `${join(ext.scriptPath, `${ext.command}.sh`)}`,
      status: existsSync(join(ext.scriptPath, `${ext.command}.sh`)) ? 'success' as const : 'warning' as const
    }));
    
    console.log(ui.createInfoPanel("🔗 Available Aliases", aliasInfo));
    console.log(ui.format.muted("💡 Add to shell config: eval \"$(rc alias-init)\""));
    console.log("");
  }

  // Extensions info with table
  
  // Filter out virtual directory-level extensions and wrapper scripts
  const actualExtensions = extensions.filter(ext => !isVirtualExtension(ext) && !isWrapperScript(ext));
  
  if (actualExtensions.length > 0) {
    const extensionData = actualExtensions.map(ext => ({
      command: ext.command,
      description: ext.config?.description || "No description",
      type: ext.scriptType
    }));
    
    console.log(ui.createBox(
      ui.createCommandList(extensionData),
      { title: `📦 Extensions (${actualExtensions.length} found)` }
    ));
  } else {
    console.log(ui.error("No extensions found", "Run 'rc --setup' to create example extensions"));
  }
  console.log("");

  // Configuration help
  const helpItems = [
    "extensionsDirs: Array of directories where extensions are stored (first = highest priority)",
    "extensionsDir: Legacy single directory setting (deprecated, use extensionsDirs)",
    "defaultRunner: Default script runner (node, python, ruby, php, bash, sh)",
    "enableLogging: Enable/disable debug logging",
    "darkMode: Theme mode (true=dark, false=light, null=auto-detect)",
    "Run 'rc --setup' to create a comprehensive config file with examples",
    "Use 'rc doctor' to diagnose conflicts between extension directories"
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
  console.log(ui.createHeader("🔄 Update Manager", "Pull the latest changes from the git repository"));

  try {
    // Get the current script's directory to find the installation
    const currentScriptPath = process.argv[1];
    if (!currentScriptPath) {
      console.log(ui.error("Could not determine script path", "Unable to locate current installation"));
      return;
    }
    
    // Find the git repository root
    let gitRepoDir: string = '';
    
    // Start from the current script directory and walk up to find .git
    let searchDir = dirname(currentScriptPath);
    while (searchDir !== '/' && searchDir !== '') {
      if (existsSync(join(searchDir, '.git'))) {
        gitRepoDir = searchDir;
        break;
      }
      searchDir = dirname(searchDir);
    }
    
    // If not found from script path, try common installation locations
    if (!gitRepoDir) {
      const possiblePaths = [
        join(process.env['HOME'] || '', '.local/bin/rodrigos-cli'),
        '/usr/local/bin/rodrigos-cli',
        '/opt/rodrigos-cli',
        process.cwd() // Current working directory
      ];
      
      for (const path of possiblePaths) {
        if (existsSync(join(path, '.git'))) {
          gitRepoDir = path;
          break;
        }
      }
    }
    
    if (!gitRepoDir || !existsSync(join(gitRepoDir, '.git'))) {
      console.log(ui.error(
        "Git repository not found",
        "Could not locate the git repository for this installation."
      ));
      console.log("\n" + ui.createBox(
        [
          "This command requires a git-based installation.",
          "",
          "To reinstall with git support:",
          "",
          `${ui.icons.bullet} git clone https://github.com/rodrigopsasaki/rodrigos-cli.git`,
          `${ui.icons.bullet} cd rodrigos-cli && npm run setup`,
          "",
          "Or use the installer:",
          "",
          `${ui.icons.bullet} curl -fsSL https://raw.githubusercontent.com/rodrigopsasaki/rodrigos-cli/main/install.sh | bash`
        ].join("\n"),
        { title: "🔧 Installation Required", borderColor: "yellow" }
      ));
      return;
    }
    
    console.log(ui.createInfoPanel("📁 Repository Found", [
      { label: "Git repository", value: gitRepoDir }
    ]));
    
    // Check git status first
    await withProgress(
      "Checking repository status...",
      async () => {
        try {
          execSync(`cd "${gitRepoDir}" && git status --porcelain`, { encoding: 'utf8' });
        } catch (error) {
          throw new Error("Could not check git status");
        }
      }
    );
    
    // Get current commit info
    const currentCommit = execSync(`cd "${gitRepoDir}" && git rev-parse --short HEAD`, { encoding: 'utf8' }).trim();
    const currentBranch = execSync(`cd "${gitRepoDir}" && git branch --show-current`, { encoding: 'utf8' }).trim();
    
    console.log(ui.createInfoPanel("📊 Current Status", [
      { label: "Branch", value: currentBranch },
      { label: "Commit", value: currentCommit }
    ]));
    
    // Pull latest changes
    await executeWithProgress([
      {
        name: "fetch",
        description: "Fetching latest changes",
        action: async () => {
          execSync(`cd "${gitRepoDir}" && git fetch origin`, { stdio: 'pipe' });
        }
      },
      {
        name: "pull", 
        description: "Pulling latest changes",
        action: async () => {
          execSync(`cd "${gitRepoDir}" && git pull origin ${currentBranch}`, { stdio: 'pipe' });
        }
      },
      {
        name: "install",
        description: "Installing dependencies",
        action: async () => {
          if (existsSync(join(gitRepoDir, 'package.json'))) {
            execSync(`cd "${gitRepoDir}" && npm install`, { stdio: 'pipe' });
          }
        }
      },
      {
        name: "build",
        description: "Building project",
        action: async () => {
          if (existsSync(join(gitRepoDir, 'package.json'))) {
            execSync(`cd "${gitRepoDir}" && npm run build`, { stdio: 'pipe' });
          }
        }
      }
    ], { showSuccess: true, showErrors: true });
    
    // Get new commit info
    const newCommit = execSync(`cd "${gitRepoDir}" && git rev-parse --short HEAD`, { encoding: 'utf8' }).trim();
    
    if (currentCommit === newCommit) {
      console.log(ui.success("Already up to date!", "No new changes were found"));
    } else {
      console.log(ui.success("Update completed!", `Updated from ${currentCommit} to ${newCommit}`));
      
      // Show what changed
      try {
        const changeLog = execSync(`cd "${gitRepoDir}" && git log --oneline ${currentCommit}..${newCommit}`, { encoding: 'utf8' }).trim();
        if (changeLog) {
          console.log("\n" + ui.createBox(
            changeLog,
            { title: "📝 Recent Changes", borderColor: "green" }
          ));
        }
      } catch (error) {
        // Ignore if we can't get the changelog
      }
    }
    
  } catch (error) {
    console.log(ui.error("Update failed", error instanceof Error ? error.message : String(error)));
    console.log("\n" + ui.createBox(
      [
        "You can try updating manually:",
        "",
        `${ui.icons.bullet} cd /path/to/rodrigos-cli`,
        `${ui.icons.bullet} git pull origin main`,
        `${ui.icons.bullet} npm install && npm run build`,
        "",
        "Or reinstall completely:",
        "",
        `${ui.icons.bullet} curl -fsSL https://raw.githubusercontent.com/rodrigopsasaki/rodrigos-cli/main/install.sh | bash`
      ].join("\n"),
      { title: "🛠️ Manual Update", borderColor: "red" }
    ));
  }
}

async function handleDoctor() {
  console.log(ui.createHeader("🩺 System Diagnostics", "Analyze configuration and identify potential conflicts"));

  // Load extensions to get conflicts
  let conflicts: any[] = [];
  let extensionSources: any[] = [];
  
  try {
    await withProgress(
      "Loading extensions...",
      () => extensionLoader.loadExtensions(),
      { successText: "Extensions loaded" }
    );
    
    conflicts = extensionLoader.getConflicts();
    extensionSources = extensionLoader.getExtensionSources();
  } catch (error) {
    console.log(ui.error("Failed to load extensions", error instanceof Error ? error.message : String(error)));
    return;
  }

  // Configuration diagnostics
  const config = configManager.getConfig();
  const configPath = configManager.getConfigPath();
  const extensionsDirs = configManager.getExtensionsDirs();

  const configDiagnostics = [
    {
      label: "Config file exists",
      value: existsSync(configPath) ? "✅ Yes" : "❌ No",
      status: existsSync(configPath) ? 'success' as const : 'error' as const
    },
    {
      label: "Configuration format",
      value: config.extensionsDirs ? "✅ New format (extensionsDirs)" : config.extensionsDir ? "⚠️ Legacy format (extensionsDir)" : "❌ No extensions config",
      status: config.extensionsDirs ? 'success' as const : config.extensionsDir ? 'warning' as const : 'error' as const
    },
    {
      label: "Extensions directories",
      value: `${extensionsDirs.length} configured`,
      status: extensionsDirs.length > 0 ? 'success' as const : 'error' as const
    }
  ];

  console.log(ui.createInfoPanel("⚙️ Configuration Status", configDiagnostics));
  console.log("");

  // Directory analysis
  const directoryItems = [];
  for (let i = 0; i < extensionsDirs.length; i++) {
    const dir = extensionsDirs[i];
    if (!dir) continue;
    
    const exists = existsSync(dir);
    const extensionsInDir = extensionSources.filter(source => source.sourceDir === dir);
    
    directoryItems.push({
      label: `Directory ${i + 1} (Priority ${i + 1})`,
      value: dir,
      status: exists ? 'success' as const : 'error' as const
    });
    
    directoryItems.push({
      label: `├─ Status`,
      value: exists ? `✅ Exists (${extensionsInDir.length} extensions)` : "❌ Does not exist"
    });
    
    if (i < extensionsDirs.length - 1) {
      directoryItems.push({
        label: "└─",
        value: ""
      });
    }
  }

  console.log(ui.createInfoPanel("📁 Extension Directories", directoryItems));
  console.log("");

  // Conflict analysis
  if (conflicts.length > 0) {
    console.log(ui.createBox(
      ui.error("⚠️ Command Conflicts Detected", `Found ${conflicts.length} command(s) with naming conflicts`),
      { title: "🚨 Conflicts", borderColor: "red" }
    ));
    console.log("");

    for (const conflict of conflicts) {
      const conflictItems: Array<{ label: string; value: string; status?: 'success' | 'error' | 'warning' | undefined }> = [
        {
          label: "Command",
          value: conflict.command,
          status: undefined
        },
        {
          label: "Active script",
          value: conflict.primaryExtension.scriptPath,
          status: 'success' as const
        }
      ];

      for (let i = 0; i < conflict.conflictingExtensions.length; i++) {
        const conflictingExt = conflict.conflictingExtensions[i];
        conflictItems.push({
          label: `Shadowed ${i + 1}`,
          value: conflictingExt.scriptPath,
          status: 'warning' as const
        });
      }

      console.log(ui.createInfoPanel(`⚡ Conflict: rc ${conflict.command}`, conflictItems));
      console.log("");
    }

    // Conflict resolution suggestions
    const resolutionSuggestions = [
      "Higher priority directories (listed first) take precedence",
      "Consider renaming conflicting scripts to avoid clashes",
      "Use different subdirectories to organize similar commands",
      "Remove unused scripts from lower-priority directories",
      "Reorder extensionsDirs in config to change priority"
    ];

    console.log(ui.createBox(
      resolutionSuggestions.map(tip => `${ui.icons.bullet} ${ui.format.muted(tip)}`).join("\n"),
      { title: "💡 Conflict Resolution", borderColor: "yellow", dimBorder: true }
    ));
    console.log("");
  } else {
    console.log(ui.success("✅ No conflicts detected", "All commands have unique names"));
    console.log("");
  }

  // Extensions summary by directory
  if (extensionSources.length > 0) {
    const summaryByDir = new Map<string, any[]>();
    
    for (const source of extensionSources) {
      if (!summaryByDir.has(source.sourceDir)) {
        summaryByDir.set(source.sourceDir, []);
      }
      summaryByDir.get(source.sourceDir)!.push(source);
    }

    const summaryItems = [];
    let totalActive = 0;
    let totalShadowed = 0;

    for (const [dir, sources] of summaryByDir.entries()) {
      const priority = sources[0]?.priority + 1 || 0;
      const activeSources = sources.filter(source => 
        !conflicts.some(conflict => 
          conflict.conflictingExtensions.some((ext: any) => ext.scriptPath === source.extension.scriptPath)
        )
      );
      const shadowedSources = sources.filter(source => 
        conflicts.some(conflict => 
          conflict.conflictingExtensions.some((ext: any) => ext.scriptPath === source.extension.scriptPath)
        )
      );
      
      totalActive += activeSources.length;
      totalShadowed += shadowedSources.length;

      summaryItems.push({
        label: `Priority ${priority}`,
        value: dir
      });
      
      summaryItems.push({
        label: "├─ Active",
        value: `${activeSources.length} commands`,
        status: activeSources.length > 0 ? 'success' as const : undefined
      });
      
      summaryItems.push({
        label: "└─ Shadowed",
        value: `${shadowedSources.length} commands`,
        status: shadowedSources.length > 0 ? 'warning' as const : undefined
      });
    }

    console.log(ui.createInfoPanel("📊 Extensions Summary", summaryItems));
    console.log("");

    console.log(ui.createInfoPanel("🎯 Overall Status", [
      {
        label: "Total directories",
        value: `${extensionsDirs.length}`,
        status: 'success' as const
      },
      {
        label: "Active commands",
        value: `${totalActive}`,
        status: totalActive > 0 ? 'success' as const : 'warning' as const
      },
      {
        label: "Shadowed commands",
        value: `${totalShadowed}`,
        status: totalShadowed === 0 ? 'success' as const : 'warning' as const
      },
      {
        label: "Health status",
        value: conflicts.length === 0 ? "✅ Healthy" : `⚠️ ${conflicts.length} conflict(s)`,
        status: conflicts.length === 0 ? 'success' as const : 'warning' as const
      }
    ]));
  }

  console.log("");
}

// Helper function to check if an extension is a virtual directory-level command
function isVirtualExtension(extension: Extension): boolean {
  try {
    // Virtual extensions have directory paths as scriptPath
    return statSync(extension.scriptPath).isDirectory();
  } catch {
    return false;
  }
}

// Helper function to check if an extension is a wrapper script (duplicates directory name)
function isWrapperScript(extension: Extension): boolean {
  const parts = extension.command.split(' ');
  if (parts.length < 2) return false;
  
  // Check if the last part equals the second-to-last part (e.g., "npm npm")
  const lastPart = parts[parts.length - 1];
  const secondToLastPart = parts[parts.length - 2];
  
  return lastPart === secondToLastPart;
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
      let matchingExtension = extensions.find(ext => ext.command === fullCommand);
      
      // If no exact match, check if it's a directory-level command
      if (!matchingExtension && commandArgs.length === 1) {
        const directoryCommands = extensions.filter(ext => ext.command.startsWith(`${fullCommand} `));
        if (directoryCommands.length > 0) {
          // Create a virtual extension for directory aliasing
          matchingExtension = {
            command: fullCommand,
            scriptPath: fullCommand, // This will trigger directory command detection
            description: `Directory commands for ${fullCommand}`,
            runner: 'virtual',
            passContext: false
          } as any;
        }
      }
      
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

      // Get rc binary path
      const rcBinaryPath = process.argv[1];
      if (!rcBinaryPath) {
        console.error(themeChalk.statusError('Could not determine rc binary path'));
        process.exit(1);
        return; // This satisfies TypeScript's control flow analysis
      }

      // Check if this is a directory-level command (virtual extension)
      const isDirectoryCommand = matchingExtension.scriptPath === aliasName || (matchingExtension.scriptPath.endsWith(aliasName as string) && !matchingExtension.scriptPath.includes('.'));
      if (isDirectoryCommand) {
        // Create directory-level alias - generate wrapper script
        await createDirectoryAlias(aliasName as string, extensions, rcBinaryPath);
        return;
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
      
      // If there are multiple commands for the same script, try to identify the main one
      if (relatedExtensions.length > 1) {
        // Look for the extension that has aliases defined in its config
        const extensionWithAliases = relatedExtensions.find(e => e.config?.aliases && e.config.aliases.length > 0);
        if (extensionWithAliases) {
          mainExtension = extensionWithAliases;
        } else {
          // If no extension has aliases, prefer shorter commands (directory-level commands)
          // over longer ones (wrapper scripts like "npm npm")
          const sortedByLength = relatedExtensions.sort((a, b) => a.command.length - b.command.length);
          mainExtension = sortedByLength[0];
        }
      }
      
      if (!mainExtension) continue;
      
      // Collect all aliases for this command
      const allAliases: string[] = [];
      
      // Add aliases from config
      if (mainExtension.config?.aliases) {
        const commandParts = mainExtension.command.split(' ');
        const baseCommand = commandParts.slice(0, -1);
        
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

    // Quick tips
    const tips = [
      "Use 'rc <command>' to execute any command",
      "Use 'rc alias <command>' to create direct aliases",
      "Use 'rc alias-init' to generate shell aliases for aliasable directories",
      "Add 'eval \"$(rc alias-init)\"' to shell config for dynamic aliasing",
      "Add --verbose to any command for debug information",
      "Commands are auto-discovered from your extensions directory"
    ];

    console.log("\n" + ui.createBox(
      tips.map(tip => `${ui.icons.bullet} ${ui.format.muted(tip)}`).join("\n"),
      { title: "💡 Tips", borderColor: "yellow", dimBorder: true }
    ));
    
    console.log("");
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
          children: {},
          commands: []
        };
      }
      
      // If this is the final part, add the command info
      if (i === parts.length - 1) {
        current[part].description = cmd.description;
        current[part].aliases = cmd.aliases;
        current[part].isLeaf = true;
      }
      
      current = current[part].children;
    }
  }
  
  // Convert tree to hierarchical items
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
      icon: hasChildren ? ui.icons.folder : ui.icons.file
    };

    if (hasChildren) {
      item.children = [];
      for (const [childCommand, childInfo] of Object.entries(info.children)) {
        let childDescription = (childInfo as any)?.description;
        
        // Add aliases to description if they exist
        if ((childInfo as any)?.aliases && (childInfo as any).aliases.length > 0) {
          const aliasNames = (childInfo as any).aliases.map((alias: string) => {
            const aliasParts = alias.split(' ');
            return aliasParts[aliasParts.length - 1]; // Get just the alias name
          });
          childDescription = childDescription + ` (aliases: ${aliasNames.join(', ')})`;
        }
        
        item.children.push({
          label: childCommand,
          description: childDescription
        });
      }
    }

    items.push(item);
  }

  return items;
}

// Removed buildHierarchicalItems function as it's no longer used

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

// Create directory-level alias that routes commands intelligently
async function createDirectoryAlias(aliasName: string, extensions: Extension[], rcBinaryPath: string): Promise<void> {
  // Find all commands that start with this directory name
  const directoryCommands = extensions.filter(ext => 
    ext.command.startsWith(`${aliasName} `) || ext.command === aliasName
  );

  if (directoryCommands.length === 0) {
    console.error(themeChalk.statusError(`❌ No commands found for directory "${aliasName}"`));
    return;
  }

  // Find the directory-level extension (virtual extension for the directory itself)
  let directoryExtension = directoryCommands.find(ext => ext.command === aliasName);
  
  // If no directory-level extension, create one from the first subcommand
  if (!directoryExtension && directoryCommands.length > 0) {
    const firstSubcommand = directoryCommands[0];
    if (!firstSubcommand) {
      console.error(themeChalk.statusError('No valid subcommand found'));
      return;
    }
    const extensionDir = dirname(firstSubcommand.scriptPath);
    directoryExtension = {
      command: aliasName,
      scriptPath: extensionDir,
      description: `Directory commands for ${aliasName}`,
      runner: 'virtual',
      passContext: false
    } as any;
  }
  
  if (!directoryExtension) {
    console.error(themeChalk.statusError('No directory-level extension found'));
    return;
  }

  // Use the directory path
  const extensionDir = directoryExtension.scriptPath;
  const wrapperPath = join(extensionDir, `${aliasName}.sh`);

  // Check if directory has aliasable config
  const configPath = join(extensionDir, `${aliasName}.yaml`);
  let isAliasable = false;
  
  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, 'utf8');
      // Simple YAML parsing for aliasable flag
      isAliasable = configContent.includes('aliasable: true');
    } catch (error) {
      console.log(themeChalk.textMuted(`   Warning: Could not read ${configPath}: ${error}`));
    }
  }

  if (!isAliasable) {
    console.error(themeChalk.statusError(`❌ Directory "${aliasName}" is not configured as aliasable`));
    console.log(themeChalk.textMuted(`   Add "aliasable: true" to ${configPath} to enable aliasing`));
    return;
  }

  // Get available subcommands
  const availableCommands = directoryCommands
    .map(ext => ext.command.replace(`${aliasName} `, ''))
    .filter(cmd => cmd !== aliasName);

  // Create bash wrapper script that routes commands
  const wrapperScript = `#!/bin/bash

# ${aliasName} wrapper - routes custom commands to rc, others to system ${aliasName}
# Generated by rc alias ${aliasName}

# Get the command being called
SUBCOMMAND="$1"

# Available custom commands
CUSTOM_COMMANDS=(${availableCommands.map(cmd => `"${cmd}"`).join(' ')})

# Check if this is a custom command
is_custom_command() {
  for cmd in "\${CUSTOM_COMMANDS[@]}"; do
    if [[ "$1" == "$cmd" ]]; then
      return 0
    fi
  done
  return 1
}

# Route the command
if [[ -z "$SUBCOMMAND" ]] || is_custom_command "$SUBCOMMAND"; then
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

  // Write the wrapper script to the directory
  writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });
  
  console.log(themeChalk.status(`🔗 Created wrapper script: ${wrapperPath}`));
  console.log(themeChalk.textMuted(`   Custom commands:`));
  availableCommands.forEach(cmd => {
    console.log(themeChalk.textMuted(`     ${aliasName} ${cmd}`));
  });
  console.log(themeChalk.textMuted(`   Other commands will be routed to system ${aliasName}`));
  console.log('');
  console.log(themeChalk.textMuted('💡 Use dynamic aliasing: eval "$(rc alias-init)" in shell config'));
}

// Handle alias-init command - scan directories and output shell aliases
async function handleAliasInit(): Promise<void> {
  try {
    const extensions = await extensionLoader.loadExtensions();
    
    // Find all directories by grouping commands
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
    
    const aliasableDirectories: string[] = [];
    
    for (const [dirName, dirCommands] of directoryMap) {
      // Get directory path from first command in the directory
      const firstCommand = dirCommands[0];
      if (!firstCommand) continue;
      const dirPath = dirname(firstCommand.scriptPath);
      const configPath = join(dirPath, `${dirName}.yaml`);
      
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf8');
          if (configContent.includes('aliasable: true')) {
            const wrapperPath = join(dirPath, `${dirName}.sh`);
            
            // Ensure wrapper exists, create if needed
            if (!existsSync(wrapperPath)) {
              await createDirectoryWrapper(dirName, extensions);
            }
            
            // Output alias command
            console.log(`alias ${dirName}='${wrapperPath}'`);
            aliasableDirectories.push(dirName);
          }
        } catch (error) {
          // Skip directories with unreadable configs
        }
      }
    }
    
    if (aliasableDirectories.length === 0) {
      console.log('# No aliasable directories found');
      console.log('# Add "aliasable: true" to directory YAML configs to enable aliasing');
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
  for cmd in "\${CUSTOM_COMMANDS[@]}"; do
    if [[ "$1" == "$cmd" ]]; then
      return 0
    fi
  done
  return 1
}

# Route the command
if [[ -z "$SUBCOMMAND" ]] || is_custom_command "$SUBCOMMAND"; then
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

// Parse arguments and run
async function main() {
  await loadExtensions();
  await program.parseAsync();
}

main().catch((error) => {
  console.error(themeChalk.statusError("Fatal error:"), error);
  process.exit(1);
});
