import chalk from "chalk";

// Detect if terminal supports colors
const supportsColor = chalk.level > 0;

// Detect if we're likely in a dark terminal
// This is a heuristic - we can't perfectly detect dark terminals
function isDarkTerminal(): boolean {
  // Check for common dark terminal environment variables
  const darkTerminalVars = [
    'COLORFGBG',
    'TERM_PROGRAM',
    'ITERM_PROFILE',
    'VSCODE_TERMINAL_THEME'
  ];
  
  for (const varName of darkTerminalVars) {
    const value = process.env[varName];
    if (value && (
      value.includes('dark') || 
      value.includes('Dark') || 
      value.includes('DARK') ||
      value.includes('black') ||
      value.includes('Black')
    )) {
      return true;
    }
  }
  
  // Default to assuming dark terminal for better UX
  return true;
}

// Theme-aware color system
class ThemeAwareChalk {
  private isDark: boolean;
  private forceDarkMode: boolean;

  constructor(forceDarkMode?: boolean) {
    this.forceDarkMode = forceDarkMode ?? false;
    this.isDark = this.forceDarkMode || isDarkTerminal();
  }

  // Update theme based on config
  setDarkMode(enabled: boolean) {
    this.forceDarkMode = enabled;
    this.isDark = this.forceDarkMode || isDarkTerminal();
  }

  // Primary colors - work well on both light and dark
  get primary() {
    return chalk.cyan;
  }

  get secondary() {
    return chalk.blue;
  }

  get accent() {
    return chalk.yellow;
  }

  get success() {
    return chalk.green;
  }

  get error() {
    return chalk.red;
  }

  get warning() {
    return chalk.magenta;
  }

  // Text colors - adaptive based on theme
  get text() {
    return this.isDark ? chalk.white : chalk.black;
  }

  get textSecondary() {
    return this.isDark ? chalk.gray : chalk.dim.black;
  }

  get textMuted() {
    // Use a more visible color for dark terminals instead of gray
    return this.isDark ? chalk.dim.white : chalk.gray;
  }

  get textDim() {
    return this.isDark ? chalk.dim.cyan : chalk.dim.gray;
  }

  // Semantic colors for different types of information
  get info() {
    return this.isDark ? chalk.cyan : chalk.blue;
  }

  get path() {
    return this.isDark ? chalk.cyan : chalk.blue;
  }

  get command() {
    return this.isDark ? chalk.yellow : chalk.magenta;
  }

  get description() {
    return this.isDark ? chalk.dim.white : chalk.gray;
  }

  get debug() {
    return this.isDark ? chalk.dim.blue : chalk.blue;
  }

  get status() {
    return this.isDark ? chalk.green : chalk.green;
  }

  get statusError() {
    return this.isDark ? chalk.red : chalk.red;
  }

  // Headers and sections
  get header() {
    return chalk.cyan.bold;
  }

  get section() {
    return chalk.yellow;
  }

  get subsection() {
    return this.isDark ? chalk.dim.cyan : chalk.cyan;
  }

  // Icons and decorations
  get icon() {
    return this.isDark ? chalk.cyan : chalk.blue;
  }

  get bullet() {
    return this.isDark ? chalk.dim.white : chalk.gray;
  }

  // Utility methods
  get supportsColor() {
    return supportsColor;
  }

  // Expose original chalk methods for compatibility
  get gray() { return this.textMuted; }
  get cyan() { return chalk.cyan; }
  get yellow() { return chalk.yellow; }
  get red() { return chalk.red; }
  get green() { return chalk.green; }
  get blue() { return chalk.blue; }
  get white() { return chalk.white; }
  get black() { return chalk.black; }
  get bold() { return chalk.bold; }
  get dim() { return chalk.dim; }
}

// Create and export the theme-aware chalk instance
export const themeChalk = new ThemeAwareChalk();

// Export the original chalk for backward compatibility
export { chalk };

// Export the theme-aware instance as the default
export default themeChalk;
