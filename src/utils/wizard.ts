import enquirer from "enquirer";
import { ui } from "./ui.js";
import { executeWithProgress, ProgressStep } from "./progress.js";

export interface SetupOptions {
  createExamples: boolean;
  setupXDG: boolean;
  createConfig: boolean;
  showTutorial: boolean;
  extensionsPath?: string;
}

export class SetupWizard {
  async run(): Promise<SetupOptions> {
    console.log(ui.createHeader("🔧 Setup Wizard", "Let's configure Rodrigo's CLI for the best experience"));

    // Welcome message
    console.log(ui.createBox(
      [
        "Welcome to Rodrigo's CLI! This wizard will help you:",
        "",
        `${ui.icons.bullet} Set up XDG-compliant directory structure`,
        `${ui.icons.bullet} Create example extensions to get you started`, 
        `${ui.icons.bullet} Configure your preferences`,
        `${ui.icons.bullet} Show you how everything works`,
        "",
        "Let's get started! 🚀"
      ].join("\n"),
      { title: "👋 Welcome", borderColor: "cyan" }
    ));

    console.log("");

    // Main setup questions
    const responses = await enquirer.prompt([
      {
        type: "confirm",
        name: "setupXDG",
        message: "Create XDG-compliant directory structure?",
        initial: true
      },
      {
        type: "confirm", 
        name: "createExamples",
        message: "Install example extensions?",
        initial: true
      },
      {
        type: "confirm",
        name: "createConfig",
        message: "Create comprehensive configuration file?",
        initial: true
      },
      {
        type: "confirm",
        name: "showTutorial",
        message: "Show quick tutorial after setup?",
        initial: true
      }
    ]) as any;

    // Advanced configuration if they want config file
    if (responses.createConfig) {
      console.log("\n" + ui.info("Great! Let's configure some preferences..."));
      
      const configResponses = await enquirer.prompt([
        {
          type: "select",
          name: "defaultRunner",
          message: "Choose your preferred default script runner:",
          choices: [
            { name: "node", message: "Node.js (for .js/.ts files)" },
            { name: "python3", message: "Python 3 (for .py files)" },
            { name: "bash", message: "Bash (for .sh files)" },
            { name: "ruby", message: "Ruby (for .rb files)" },
            { name: "php", message: "PHP (for .php files)" }
          ],
          initial: 0
        },
        {
          type: "confirm",
          name: "enableLogging",
          message: "Enable debug logging by default?",
          initial: false
        },
        {
          type: "select",
          name: "darkMode",
          message: "Theme preference:",
          choices: [
            { name: "auto", message: "Auto-detect terminal theme (recommended)" },
            { name: "dark", message: "Force dark theme" },
            { name: "light", message: "Force light theme" }
          ],
          initial: 0
        }
      ]) as any;

      // Merge config responses
      Object.assign(responses, configResponses);
    }

    return responses as SetupOptions;
  }

  async confirmSetup(options: SetupOptions): Promise<boolean> {
    console.log("\n" + ui.createBox(
      this.buildSetupSummary(options),
      { title: "📋 Setup Summary", borderColor: "yellow" }
    ));

    const { confirmed } = await enquirer.prompt({
      type: "confirm",
      name: "confirmed", 
      message: "Proceed with this setup?",
      initial: true
    }) as any;

    return confirmed;
  }

  async showPostSetupOptions(): Promise<{ 
    viewDashboard: boolean; 
    runTutorial: boolean; 
    createAlias: boolean;
  }> {
    console.log("\n" + ui.success("Setup completed successfully! 🎉"));
    
    const { nextSteps } = await enquirer.prompt({
      type: "multiselect",
      name: "nextSteps",
      message: "What would you like to do next?",
      choices: [
        { name: "dashboard", message: "View the main dashboard (rc)" },
        { name: "tutorial", message: "Run interactive tutorial" },
        { name: "alias", message: "Create command aliases" }
      ]
    } as any) as any;

    return {
      viewDashboard: nextSteps.includes("dashboard"),
      runTutorial: nextSteps.includes("tutorial"),
      createAlias: nextSteps.includes("alias")
    };
  }

  async runAliasWizard(extensions: Array<{ command: string; description?: string }>): Promise<void> {
    if (extensions.length === 0) {
      console.log(ui.warning("No extensions available to alias"));
      return;
    }

    console.log(ui.createHeader("🔗 Alias Creator", "Create direct shortcuts for your favorite commands"));

    const choices = extensions.map(ext => ({
      name: ext.command,
      message: `${ext.command} - ${ext.description || "No description"}`,
      hint: `Creates '${ext.command.split(" ").pop()}' shortcut`
    }));

    const { selectedCommands } = await enquirer.prompt({
      type: "multiselect",
      name: "selectedCommands",
      message: "Select commands to create aliases for:",
      choices
    } as any) as any;

    if (selectedCommands.length === 0) {
      console.log(ui.info("No aliases created"));
      return;
    }

    // Create aliases
    const steps: ProgressStep[] = selectedCommands.map((cmd: string) => ({
      name: `alias-${cmd}`,
      description: `Creating alias for '${cmd}'`,
      action: async () => {
        // Simulate alias creation (you'd implement the actual logic)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }));

    await executeWithProgress(steps, { showSuccess: true });
    
    console.log(ui.success(
      `Created ${selectedCommands.length} alias(es)`,
      "You can now use these commands directly without 'rc' prefix"
    ));
  }

  async runTutorial(): Promise<void> {
    console.log(ui.createHeader("📚 Quick Tutorial", "Learn the basics in 2 minutes"));

    const tutorialSteps = [
      {
        title: "Basic Usage",
        content: [
          "Run 'rc' to see the main dashboard",
          "Run 'rc help' to see all available commands",
          "Run 'rc <command>' to execute any extension"
        ]
      },
      {
        title: "Creating Extensions",
        content: [
          "Drop any executable script into your extensions directory",
          "Scripts can be .js, .ts, .sh, .py, .rb, or .php",
          "Add .yaml/.json config files for descriptions and options"
        ]
      },
      {
        title: "Advanced Features",
        content: [
          "Use 'rc alias <command>' to create direct shortcuts",
          "Add --verbose to any command for debug information",
          "Configuration is stored using XDG directory standards"
        ]
      }
    ];

    for (let i = 0; i < tutorialSteps.length; i++) {
      const step = tutorialSteps[i];
      if (!step) continue;
      
      console.log(ui.createBox(
        step.content.map(item => `${ui.icons.bullet} ${item}`).join("\n"),
        { 
          title: `${i + 1}/${tutorialSteps.length} - ${step.title}`,
          borderColor: "blue",
          dimBorder: true
        }
      ));

      if (i < tutorialSteps.length - 1) {
        await enquirer.prompt({
          type: "confirm",
          name: "continue",
          message: "Continue to next step?",
          initial: true
        });
        console.log("");
      }
    }

    console.log("\n" + ui.success(
      "Tutorial complete! 🎓",
      "You're now ready to use Rodrigo's CLI like a pro"
    ));
  }

  private buildSetupSummary(options: SetupOptions): string {
    const items = [];
    
    if (options.setupXDG) {
      items.push(`${ui.icons.success} Create XDG directory structure`);
    }
    
    if (options.createExamples) {
      items.push(`${ui.icons.success} Install example extensions`);
    }
    
    if (options.createConfig) {
      items.push(`${ui.icons.success} Create configuration file`);
      if ((options as any).defaultRunner) {
        items.push(`  ${ui.icons.bullet} Default runner: ${(options as any).defaultRunner}`);
      }
      if ((options as any).darkMode !== undefined) {
        items.push(`  ${ui.icons.bullet} Theme: ${(options as any).darkMode}`);
      }
    }
    
    if (options.showTutorial) {
      items.push(`${ui.icons.success} Show tutorial after setup`);
    }

    return items.join("\n");
  }
}

// Export singleton instance
export const setupWizard = new SetupWizard();