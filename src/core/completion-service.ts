import type { CompletionSuggestion } from '../types/index.js';
import { ExtensionLoader } from './extension-loader.js';

export class CompletionService {
  private extensionLoader: ExtensionLoader;

  constructor(extensionLoader: ExtensionLoader) {
    this.extensionLoader = extensionLoader;
  }

    async getSuggestions(args: string[]): Promise<CompletionSuggestion[]> {
    const extensions = await this.extensionLoader.loadExtensions();
    const suggestions: CompletionSuggestion[] = [];

    // Filter out the --complete flag and any trailing --
    const cleanArgs = args.filter(arg => arg !== '--complete' && arg !== '--');

    // If no args, suggest top-level commands
    if (cleanArgs.length === 0) {
      const topLevelCommands = new Set<string>();
      for (const ext of extensions) {
        const firstPart = ext.command.split(' ')[0];
        if (firstPart) {
          topLevelCommands.add(firstPart);
        }
      }
      
      for (const command of topLevelCommands) {
        if (command) {
          suggestions.push({
            text: command,
            type: 'command',
          });
        }
      }
      return suggestions;
    }

    // Find matching extensions for the current command path
    const currentPath = cleanArgs.join(' ');
    const matchingExtensions = extensions.filter(ext => 
      ext.command.startsWith(currentPath + ' ')
    );

    if (matchingExtensions.length > 0) {
      // Suggest next level commands
      const nextLevelCommands = new Set<string>();
      for (const ext of matchingExtensions) {
        const parts = ext.command.split(' ');
        const nextPart = parts[cleanArgs.length];
        if (nextPart) {
          nextLevelCommands.add(nextPart);
        }
      }
      
      for (const command of nextLevelCommands) {
        suggestions.push({
          text: command,
          type: 'command',
        });
      }
    } else {
      // Check if we have an exact match and suggest options
      const exactMatch = extensions.find(ext => ext.command === currentPath);
      if (exactMatch?.config?.options) {
        for (const option of exactMatch.config.options) {
          suggestions.push({
            text: `--${option.name}`,
            description: option.description || undefined,
            type: 'option',
          });
          
          if (option.short) {
            suggestions.push({
              text: `-${option.short}`,
              description: option.description || undefined,
              type: 'option',
            });
          }
        }
      }
    }

    return suggestions;
  }

  generateCompletionScript(shell: string): string {
    switch (shell.toLowerCase()) {
      case 'zsh':
        return this.generateZshCompletion();
      case 'bash':
        return this.generateBashCompletion();
      case 'fish':
        return this.generateFishCompletion();
      default:
        throw new Error(`Unsupported shell: ${shell}`);
    }
  }

  private generateZshCompletion(): string {
    return `#compdef rc

_rc() {
    local curcontext="$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '1: :->cmds' \\
        '*:: :->args'

    case "$state" in
        cmds)
            local commands
            commands=(\${(f)"\$(rc --complete --)"})
            _describe -t commands 'rc commands' commands
            ;;
        args)
            local commands
            commands=(\${(f)"\$(rc --complete -- "\$words[2,-1]")"})
            _describe -t commands 'rc commands' commands
            ;;
    esac
}

compdef _rc rc
`;
  }

  private generateBashCompletion(): string {
    return `_rc_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    if [[ \$COMP_CWORD -eq 1 ]]; then
        # First argument - suggest commands
        opts=\$(rc --complete --)
        COMPREPLY=( \$(compgen -W "\$opts" -- "\$cur") )
    else
        # Subsequent arguments - suggest based on context
        opts=\$(rc --complete -- "\${COMP_WORDS[@]:1}")
        COMPREPLY=( \$(compgen -W "\$opts" -- "\$cur") )
    fi
}

complete -F _rc_completion rc
`;
  }

  private generateFishCompletion(): string {
    return `function __fish_rc_complete
    set -l cmd (commandline -opc)
    set -l suggestions (rc --complete -- \$cmd[2..-1])
    printf "%s\\n" \$suggestions
end

complete -c rc -f -a "(__fish_rc_complete)"
`;
  }
} 