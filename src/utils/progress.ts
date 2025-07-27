import { Ora } from "ora";
import { ui } from "./ui.js";

export interface ProgressStep {
  name: string;
  description?: string;
  action: () => Promise<void>;
}

export interface ProgressOptions {
  showSuccess?: boolean;
  showErrors?: boolean;
  concurrent?: boolean;
}

// Progress manager for handling async operations with visual feedback
export class ProgressManager {
  private activeSpinner: Ora | null = null;

  // Execute a single async operation with spinner
  async withSpinner<T>(
    text: string, 
    action: () => Promise<T>,
    options: { successText?: string; errorText?: string } = {}
  ): Promise<T> {
    this.activeSpinner = ui.createSpinner(text);
    this.activeSpinner.start();

    try {
      const result = await action();
      
      if (options.successText) {
        this.activeSpinner.succeed(ui.format.muted(options.successText));
      } else {
        this.activeSpinner.stop();
      }
      
      return result;
    } catch (error) {
      const errorMessage = options.errorText || `Failed: ${text}`;
      this.activeSpinner.fail(ui.format.muted(errorMessage));
      throw error;
    } finally {
      this.activeSpinner = null;
    }
  }

  // Execute multiple steps with progress feedback
  async executeSteps(
    steps: ProgressStep[], 
    options: ProgressOptions = {}
  ): Promise<void> {
    const { showSuccess = true, showErrors = true, concurrent = false } = options;

    if (concurrent) {
      await this.executeConcurrentSteps(steps, { showSuccess, showErrors });
    } else {
      await this.executeSequentialSteps(steps, { showSuccess, showErrors });
    }
  }

  // Execute steps sequentially with individual spinners
  private async executeSequentialSteps(
    steps: ProgressStep[],
    options: { showSuccess: boolean; showErrors: boolean }
  ): Promise<void> {
    const errors: Array<{ step: string; error: Error }> = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;
      
      const stepNumber = `[${i + 1}/${steps.length}]`;
      const spinnerText = `${stepNumber} ${step.description || step.name}`;

      try {
        await this.withSpinner(
          spinnerText,
          step.action,
          options.showSuccess ? { 
            successText: `${stepNumber} ${step.name} completed` 
          } : {}
        );
      } catch (error) {
        errors.push({ step: step.name, error: error as Error });
        
        if (options.showErrors) {
          console.log(ui.error(`${stepNumber} ${step.name} failed`, error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Show summary if there were errors
    if (errors.length > 0) {
      console.log('\n' + ui.createSeparator());
      console.log(ui.error(`${errors.length} step(s) failed:`));
      for (const { step, error } of errors) {
        console.log(ui.format.muted(`  • ${step}: ${error.message}`));
      }
      throw new Error(`${errors.length} steps failed`);
    }
  }

  // Execute steps concurrently with overall progress
  private async executeConcurrentSteps(
    steps: ProgressStep[],
    options: { showSuccess: boolean; showErrors: boolean }
  ): Promise<void> {
    const spinner = ui.createSpinner(`Executing ${steps.length} operations...`);
    spinner.start();

    try {
      const promises = steps.map(async (step) => {
        try {
          await step.action();
          return { step: step.name, success: true, error: null };
        } catch (error) {
          return { step: step.name, success: false, error: error as Error };
        }
      });

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.success);

      if (failed.length === 0) {
        if (options.showSuccess) {
          spinner.succeed(`All ${steps.length} operations completed successfully`);
        } else {
          spinner.stop();
        }
      } else {
        spinner.fail(`${failed.length}/${steps.length} operations failed`);
        
        if (options.showErrors) {
          console.log('\n' + ui.error('Failed operations:'));
          for (const result of failed) {
            console.log(ui.format.muted(`  • ${result.step}: ${result.error?.message}`));
          }
        }
        
        throw new Error(`${failed.length} operations failed`);
      }
    } catch (error) {
      spinner.fail('Operations failed');
      throw error;
    }
  }

  // Stop any active spinner
  stop(): void {
    if (this.activeSpinner) {
      this.activeSpinner.stop();
      this.activeSpinner = null;
    }
  }

  // Create a progress bar for file operations or downloads
  createFileProgress(filename: string, totalSize?: number): {
    update: (current: number) => void;
    complete: () => void;
    fail: (error: string) => void;
  } {
    const spinner = ui.createSpinner(`Processing ${filename}...`);
    spinner.start();

    return {
      update: (current: number) => {
        if (totalSize) {
          const percentage = Math.round((current / totalSize) * 100);
          spinner.text = ui.format.muted(`Processing ${filename}... ${percentage}%`);
        } else {
          spinner.text = ui.format.muted(`Processing ${filename}... ${current} bytes`);
        }
      },
      complete: () => {
        spinner.succeed(ui.format.muted(`${filename} processed successfully`));
      },
      fail: (error: string) => {
        spinner.fail(ui.format.muted(`Failed to process ${filename}: ${error}`));
      }
    };
  }

  // Utility for delay operations (useful for demos)
  async delay(ms: number, text?: string): Promise<void> {
    if (text) {
      const spinner = ui.createSpinner(text);
      spinner.start();
      await new Promise(resolve => setTimeout(resolve, ms));
      spinner.stop();
    } else {
      await new Promise(resolve => setTimeout(resolve, ms));
    }
  }
}

// Helper functions for common operations
export async function withProgress<T>(
  text: string,
  action: () => Promise<T>,
  options?: { successText?: string; errorText?: string }
): Promise<T> {
  const manager = new ProgressManager();
  return manager.withSpinner(text, action, options);
}

export async function executeWithProgress(
  steps: ProgressStep[],
  options?: ProgressOptions
): Promise<void> {
  const manager = new ProgressManager();
  return manager.executeSteps(steps, options);
}

// Export singleton instance for convenience
export const progress = new ProgressManager();