import boxen from "boxen";
import Table from "cli-table3";
import figures from "figures";
import ora, { Ora } from "ora";
import { themeChalk } from "./chalk.js";

// Corporate-grade UI components for premium CLI experience

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface BoxOptions {
  title?: string;
  subtitle?: string;
  padding?: number;
  margin?: number;
  borderColor?: string;
  backgroundColor?: string;
  dimBorder?: boolean;
}

export interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string | undefined;
}

class PremiumUI {
  // Professional icons using figures
  readonly icons = {
    // Status indicators
    success: figures.tick,
    error: figures.cross,
    warning: figures.warning,
    info: figures.info,
    
    // Navigation and structure
    arrow: figures.arrowRight,
    bullet: figures.bullet,
    line: figures.line,
    
    // Actions
    play: figures.play,
    stop: figures.square,
    refresh: figures.circleFilled,
    
    // File types  
    folder: "📁",
    file: "📄",
    
    // Progress
    spinner: figures.ellipsis,
    
    // Special
    star: figures.star,
    heart: figures.heart,
    lightning: "⚡",
    gear: "⚙️",
    home: figures.home,
    
    // Borders
    cornerTopLeft: figures.lineDownRight,
    cornerTopRight: figures.lineDownLeft,
    cornerBottomLeft: figures.lineUpRight,
    cornerBottomRight: figures.lineUpLeft,
  };

  // Create professional boxed content
  createBox(content: string, options: BoxOptions = {}): string {
    const {
      title,
      subtitle,
      padding = 1,
      margin = 0,
      borderColor = 'cyan',
      dimBorder = false
    } = options;

    const boxOptions: any = {
      title: title ? themeChalk.bold(title) : undefined,
      titleAlignment: 'left',
      padding,
      margin: typeof margin === 'number' ? margin : undefined,
      borderStyle: 'round',
      borderColor: dimBorder ? 'gray' : borderColor as any,
      width: Math.min(process.stdout.columns || 80, 100)
    };

    let boxContent = content;
    if (subtitle) {
      boxContent = `${themeChalk.textMuted(subtitle)}\n\n${content}`;
    }

    return boxen(boxContent, boxOptions);
  }

  // Create information panels
  createInfoPanel(title: string, items: Array<{ label: string; value: string; status?: 'success' | 'error' | 'warning' | undefined }>): string {
    let content = '';
    
    for (const item of items) {
      const icon = item.status ? this.getStatusIcon(item.status) : this.icons.bullet;
      const valueColor = item.status === 'error' ? themeChalk.error : 
                        item.status === 'warning' ? themeChalk.warning :
                        item.status === 'success' ? themeChalk.success : themeChalk.textMuted;
      
      content += `${icon} ${themeChalk.textSecondary(item.label)}: ${valueColor(item.value)}\n`;
    }

    return this.createBox(content.trim(), {
      title,
      borderColor: 'blue',
      dimBorder: true
    });
  }

  // Create professional tables
  createTable(columns: TableColumn[], data: Array<Record<string, any>>): string {
    const table = new Table({
      head: columns.map(col => themeChalk.header(col.header)),
      style: {
        head: [],
        border: ['gray'],
        'padding-left': 1,
        'padding-right': 1
      },
      colWidths: columns.map(col => col.width || null),
      colAligns: columns.map(col => col.align || 'left')
    });

    for (const row of data) {
      const tableRow = columns.map(col => {
        const value = row[col.key] || '';
        return String(value);
      });
      table.push(tableRow);
    }

    return table.toString();
  }

  // Create command listing
  createCommandTable(commands: Array<{ command: string; description: string; type?: string }>): string {
    // Calculate available width
    const terminalWidth = process.stdout.columns || 80;
    const availableWidth = Math.min(terminalWidth - 10, 90); // Leave some margin
    
    // Dynamic column sizing
    const typeWidth = 8;
    const commandWidth = 22;
    const descriptionWidth = availableWidth - commandWidth - typeWidth - 6; // 6 for borders and padding
    
    const table = new Table({
      head: [
        themeChalk.header('Command'),
        themeChalk.header('Description'),
        themeChalk.header('Type')
      ],
      style: {
        head: [],
        border: ['gray'],
        'padding-left': 1,
        'padding-right': 1
      },
      colWidths: [commandWidth, descriptionWidth, typeWidth],
      wordWrap: true
    });

    for (const cmd of commands) {
      // Truncate command if too long
      const fullCommand = `rc ${cmd.command}`;
      const displayCommand = fullCommand.length > commandWidth - 2 
        ? fullCommand.substring(0, commandWidth - 5) + '...'
        : fullCommand;
      
      // Truncate description if too long
      const description = cmd.description || 'No description';
      const displayDescription = description.length > descriptionWidth - 2
        ? description.substring(0, descriptionWidth - 5) + '...'
        : description;
      
      table.push([
        themeChalk.primary(displayCommand),
        displayDescription,
        cmd.type ? themeChalk.accent(cmd.type) : themeChalk.textMuted('script')
      ]);
    }

    return table.toString();
  }

  // Create simple command list (alternative to table for better formatting)
  createCommandList(commands: Array<{ command: string; description: string; type?: string; aliases?: string[] }>): string {
    let output = '';
    
    for (const cmd of commands) {
      const commandStr = themeChalk.primary(`rc ${cmd.command}`);
      const typeStr = cmd.type ? themeChalk.accent(`[${cmd.type}]`) : themeChalk.textMuted('[script]');
      const description = cmd.description || 'No description available';
      
      output += `${this.icons.bullet} ${commandStr} ${typeStr}\n`;
      output += `   ${themeChalk.textMuted(description)}\n`;
      
      if (cmd.aliases && cmd.aliases.length > 0) {
        const aliasesStr = cmd.aliases.map(alias => {
          // If alias already includes the full command path, just prepend 'rc'
          if (alias.includes(' ')) {
            return themeChalk.accent(`rc ${alias}`);
          } else {
            // Otherwise, construct the full path like the original logic
            return themeChalk.accent(`rc ${cmd.command.split(' ').slice(0, -1).concat(alias).join(' ')}`);
          }
        }).join(', ');
        output += `   ${themeChalk.textMuted('Aliases:')} ${aliasesStr}\n`;
      }
      
      output += '\n';
    }
    
    return output.trim();
  }

  // Status messages with consistent formatting
  createStatusMessage({ type, message, details }: StatusMessage): string {
    const icon = this.getStatusIcon(type);
    const color = this.getStatusColor(type);
    
    let output = `${icon} ${color(message)}`;
    if (details) {
      output += `\n   ${themeChalk.textMuted(details)}`;
    }
    
    return output;
  }

  // Quick status methods
  success(message: string, details?: string): string {
    return this.createStatusMessage({ type: 'success', message, details });
  }

  error(message: string, details?: string): string {
    return this.createStatusMessage({ type: 'error', message, details });
  }

  warning(message: string, details?: string): string {
    return this.createStatusMessage({ type: 'warning', message, details });
  }

  info(message: string, details?: string): string {
    return this.createStatusMessage({ type: 'info', message, details });
  }

  // Create loading spinner
  createSpinner(text: string): Ora {
    return ora({
      text: themeChalk.textMuted(text),
      spinner: 'dots',
      color: 'cyan'
    });
  }

  // Dashboard header with branding
  createHeader(title: string, subtitle?: string): string {
    const headerContent = subtitle 
      ? `${themeChalk.primary.bold(title)}\n${themeChalk.textMuted(subtitle)}`
      : themeChalk.primary.bold(title);

    return this.createBox(headerContent, {
      borderColor: 'cyan',
      padding: 1,
      margin: 0
    });
  }

  // Create hierarchical list
  createHierarchicalList(items: Array<{ 
    label: string; 
    children?: Array<{ label: string; description?: string }>;
    description?: string;
    icon?: string;
  }>): string {
    let output = '';
    
    for (const item of items) {
      const icon = item.icon || this.icons.folder;
      output += `${icon} ${themeChalk.primary(item.label)}`;
      
      if (item.description) {
        output += ` ${themeChalk.textMuted('- ' + item.description)}`;
      }
      output += '\n';
      
      if (item.children) {
        for (const child of item.children) {
          output += `  ${this.icons.arrow} ${themeChalk.secondary(child.label)}`;
          if (child.description) {
            output += ` ${themeChalk.textMuted('- ' + child.description)}`;
          }
          output += '\n';
        }
      }
    }
    
    return output.trim();
  }

  // Create progress bar (simple text-based)
  createProgressBar(current: number, total: number, width: number = 30): string {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${themeChalk.accent(bar)} ${themeChalk.textMuted(`${percentage}% (${current}/${total})`)}`;
  }

  // Create separator lines
  createSeparator(width?: number): string {
    const lineWidth = width || Math.min(process.stdout.columns || 80, 80);
    return themeChalk.textMuted('─'.repeat(lineWidth));
  }

  // Helper methods
  private getStatusIcon(type: StatusMessage['type']): string {
    switch (type) {
      case 'success': return this.icons.success;
      case 'error': return this.icons.error;
      case 'warning': return this.icons.warning;
      case 'info': return this.icons.info;
      default: return this.icons.bullet;
    }
  }

  private getStatusColor(type: StatusMessage['type']) {
    switch (type) {
      case 'success': return themeChalk.success;
      case 'error': return themeChalk.error;
      case 'warning': return themeChalk.warning;
      case 'info': return themeChalk.info;
      default: return themeChalk.text;
    }
  }

  // Layout helpers
  indent(text: string, spaces: number = 2): string {
    const indentation = ' '.repeat(spaces);
    return text.split('\n').map(line => indentation + line).join('\n');
  }

  centerText(text: string, width?: number): string {
    const lineWidth = width || process.stdout.columns || 80;
    const padding = Math.max(0, Math.floor((lineWidth - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  // Quick formatting
  format = {
    command: (text: string) => themeChalk.primary(`rc ${text}`),
    path: (text: string) => themeChalk.path(text),
    highlight: (text: string) => themeChalk.accent(text),
    muted: (text: string) => themeChalk.textMuted(text),
    bold: (text: string) => themeChalk.bold(text),
    code: (text: string) => themeChalk.accent(`\`${text}\``),
  };
}

// Export singleton instance
export const ui = new PremiumUI();

// Export the class for advanced usage
export { PremiumUI };