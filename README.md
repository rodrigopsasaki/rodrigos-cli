# 🤖 Rodrigo's CLI (rc)

A developer-first CLI framework that makes local commands feel native — like they were always part of your environment. Built with XDG compliance, theme-aware colors, and a delightful developer experience.

## ✨ Features

- **🎯 Zero boilerplate**: Drop a script into a folder and it works instantly
- **📁 Directory-based extensions**: Recursively scan and register commands
- **🔄 Runtime-agnostic**: Support for Node.js, TypeScript, Bash, Python, Ruby, PHP
- **⚙️ Sidecar configs**: Optional YAML/JSON metadata for enhanced functionality
- **🏷️ Command aliases**: Define multiple ways to call the same command
- **📋 Directory-level configs**: Command groups with their own descriptions and options
- **🔀 Command wrapping**: Extend existing tools (like npm) with custom commands
- **🔍 First-class autocomplete**: Tab completion for all shells (zsh, bash, fish)
- **🎨 Theme-aware colors**: Automatic dark/light terminal detection
- **📊 XDG compliance**: Follows XDG Base Directory Specification
- **🐛 Debug mode**: Built-in verbose logging for troubleshooting
- **🎭 Dad jokes**: Because why not?

## 🚀 Quick Start

### Installation

#### Option 1: One-liner (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/rodrigopsasaki/rodrigos-cli/main/install.sh | bash
```

#### Option 2: Manual installation

```bash
# Clone the repository
git clone https://github.com/rodrigopsasaki/rodrigos-cli.git
cd rodrigos-cli

# Run the installer
./install.sh
```

#### Option 3: Using npm scripts

```bash
# Clone and setup
git clone https://github.com/rodrigopsasaki/rodrigos-cli.git
cd rodrigos-cli
npm run setup
```

### 🔗 Immutable Entrypoint System

rc uses an innovative **immutable entrypoint system** that ensures your CLI installation is always up-to-date and self-healing:

#### How it works:

1. **Immutable Entrypoint**: The installer creates `~/.local/bin/rc-immutable` - a script that always points to the latest version
2. **Smart Symlink**: The `rc` command is a symlink that points to `rc-immutable`
3. **Self-Updating**: The immutable entrypoint can update itself and the underlying installation
4. **Future-Proof**: Even if you have an "outdated" symlink, it will still work and can self-update

#### Benefits:

- **🔄 Self-Healing**: Outdated installations automatically get the latest features
- **🛡️ Reliable**: The symlink never breaks, even across major updates
- **⚡ Seamless**: Updates happen transparently without manual intervention
- **🔧 Smart**: Detects development vs production environments

#### Example scenario:

```bash
# User installs rc v1.0 (without --update feature)
curl -fsSL https://raw.githubusercontent.com/rodrigopsasaki/rodrigos-cli/main/install.sh | bash

# Later, rc v2.0 is released with --update feature
# The user's symlink still works because it points to rc-immutable
rc --update  # This works! The immutable entrypoint has the new feature
```

#### Updating:

```bash
# Update to the latest version
rc --update

# Or manually reinstall
curl -fsSL https://raw.githubusercontent.com/rodrigopsasaki/rodrigos-cli/main/install.sh | bash
```

### First Run

After installation, run `rc` to see your current configuration:

```bash
rc
```

This will show:
- Configuration file location
- Extensions directory
- Available extensions
- Quick start commands

### Setup Extensions

Create example extensions and XDG-compliant directory structure:

```bash
rc --setup
```

This will:
- Create XDG directory structure (`~/.config/rc/`, `~/.local/share/rc/`, etc.)
- Copy example extensions
- Create comprehensive configuration file
- Set up proper file organization

### Shell Completion

Add shell completion for the best experience:

```bash
# For zsh
eval "$(rc completion zsh)"

# For bash
eval "$(rc completion bash)"

# For fish
eval "$(rc completion fish)"
```

## 📁 XDG Directory Structure

rc follows the XDG Base Directory Specification for proper file organization:

```
~/.config/rc/                    # Configuration files
├── config.yaml                  # Main configuration
└── ...

~/.local/share/rc/               # Data files
├── extensions/                  # Your custom extensions
│   ├── gen/
│   │   ├── gen.yaml            # Directory-level config
│   │   ├── uuid.cjs
│   │   ├── uuid.yaml
│   │   ├── objectid.sh
│   │   ├── objectid.yaml
│   │   ├── rstring.sh
│   │   └── rstring.yaml
│   ├── npm/
│   │   ├── npm.yaml            # npm wrapper config
│   │   ├── show-scripts.sh     # Custom npm command
│   │   └── show-scripts.yaml   # With aliases: [ss]
│   ├── git/
│   │   ├── aliases.sh
│   │   └── aliases.yaml
│   └── aws/
│       ├── s3/
│       │   ├── sync.sh
│       │   └── sync.yaml
│       └── ec2/
│           ├── list.js
│           └── list.yaml

~/.cache/rc/                     # Cache files (future use)
└── ...

~/.local/state/rc/               # State files (future use)
└── ...
```

This creates commands like:
- `rc gen uuid`
- `rc gen objectid`
- `rc gen rstring`
- `rc npm show-scripts` / `rc npm ss` (with alias)
- `rc git aliases`
- `rc aws s3 sync`
- `rc aws ec2 list`


## ⚙️ Supported Runtimes

| Extension | Runner  | Example           |
| --------- | ------- | ----------------- |
| `.js`     | Node.js | `runner: node`    |
| `.ts`     | tsx     | `runner: tsx`     |
| `.sh`     | bash    | `runner: bash`    |
| `.py`     | python3 | `runner: python3` |
| `.rb`     | ruby    | `runner: ruby`    |
| `.php`    | php     | `runner: php`     |

## 📋 Sidecar Configuration

Every script can have an optional sidecar YAML/JSON file for metadata:

```yaml
# example.yaml
description: What this command does
runner: node
passContext: true
aliases:
  - short-name
  - alias2
options:
  - name: profile
    type: string
    description: Environment profile
    suggestions: [dev, prod, staging]
    required: true
  - name: verbose
    type: boolean
    description: Enable verbose output
    short: v
```

### Directory-Level Configuration

Command groups can have their own sidecar configs:

```yaml
# gen/gen.yaml
description: Generate various types of data (UUIDs, ObjectIDs, random strings)
options:
  - name: help
    type: string
    description: Show help for specific generator
```

This gives the `gen` command its own description and options, separate from its child commands.

### Configuration Options

- **description**: Help text for the command
- **runner**: Override the default runtime
- **passContext**: Pass execution context as JSON to stdin
- **aliases**: Array of alternative names for the command
- **options**: Define command-line options with validation

## 🎯 Environment Variables

Extensions receive context through environment variables:

- `RC_COMMAND`: Full command path (e.g., "aws s3 sync")
- `RC_SCRIPT_PATH`: Path to the executing script
- `RC_SCRIPT_TYPE`: Script type (js, ts, sh, py, rb, php)
- `RC_<OPTION_NAME>`: Any command-line options

## 🧪 Example Extensions

### Shell Script with Context

```bash
#!/bin/bash
# ~/.local/share/rc/extensions/deploy.sh

echo "Deploying to environment: $RC_PROFILE"
echo "Command: $RC_COMMAND"

# Access context as JSON if passContext is enabled
if [ -t 0 ]; then
  echo "No context provided"
else
  context=$(cat)
  echo "Context: $context"
fi
```

### Node.js Extension

```javascript
#!/usr/bin/env node
// ~/.local/share/rc/extensions/secret.js

import { randomBytes } from "crypto";

const length = process.env.RC_LENGTH || 32;
const secret = randomBytes(parseInt(length)).toString("hex");
console.log(secret);
```

### Python Extension

```python
#!/usr/bin/bin/python3
# ~/.local/share/rc/extensions/weather.py

import os
import sys
import json

city = os.environ.get('RC_CITY', 'San Francisco')
print(f"Weather in {city}: Sunny with a chance of code reviews! ☀️")

# Read context from stdin if provided
if not sys.stdin.isatty():
    context = json.load(sys.stdin)
    print(f"Context: {context}")
```

## ⚙️ Configuration

Configuration is stored following the XDG Base Directory Specification:

```bash
# Default location
~/.config/rc/config.yaml

# Example configuration
extensionsDir: ~/.local/share/rc/extensions
defaultRunner: node
enableLogging: true
darkMode: null  # Auto-detect terminal theme
```

### Configuration Options

- **extensionsDir**: Directory where your extensions are stored
- **defaultRunner**: Default script runner (node, python, ruby, php, bash, sh)
- **enableLogging**: Enable/disable debug logging
- **darkMode**: Theme mode (true=dark, false=light, null=auto-detect)

## 🎨 Theme Support

rc automatically detects your terminal theme and adjusts colors accordingly:

- **Dark terminals**: Uses brighter colors for better visibility
- **Light terminals**: Uses darker colors for contrast
- **Configurable**: Override with `darkMode` setting in config
- **Environment-aware**: Respects terminal environment variables

## 🎭 Commands

### Core Commands

- `rc` - Show configuration info and quick start commands
- `rc help` - Show all available commands recursively (includes aliases)
- `rc completion <shell>` - Generate shell completion script
- `rc --setup` - Create example extensions and XDG directory structure
- `rc --config` - Show detailed configuration and XDG directory info
- `rc --migrate` - Show XDG directory structure and benefits
- `rc --joke` - Show a dad joke
- `rc --verbose` / `rc --debug` - Enable debug logging

### Extension Commands

All commands discovered from your extensions directory are automatically available with full help and autocomplete support.

## 🏷️ Command Aliases

### Sidecar Aliases

Define multiple ways to call the same command using sidecar YAML files:

```yaml
# show-scripts.yaml
description: Show available npm scripts in a nice format
runner: bash
aliases:
  - ss
  - scripts
```

This creates multiple commands that all execute the same script:
- `rc npm show-scripts`
- `rc npm ss` 
- `rc npm scripts`

All aliases are automatically:
- **Discoverable**: Shown in help output with proper formatting
- **Auto-completed**: Tab completion works for all variations
- **Conflict-aware**: The `rc doctor` command detects naming conflicts

### Example: npm Extension with Aliases

```bash
# Create npm extension directory
mkdir -p ~/.local/share/rc/extensions/npm

# show-scripts.sh - Custom npm command
#!/bin/bash
echo "📦 Available npm scripts:"
# ... script content ...

# show-scripts.yaml - Configuration with alias
description: Show available npm scripts in a nice format
runner: bash
aliases:
  - ss
```

This creates:
- `npm show-scripts` - Full command name
- `npm ss` - Short alias

## 🔗 Smart Command Aliasing

Create intelligent wrappers that make rc commands feel native while preserving system functionality:

```bash
# Create command wrappers
rc alias gen             # Creates 'gen' wrapper for all gen commands
rc alias npm             # Creates 'npm' wrapper that extends system npm

# Set up all aliases at once
eval "$(rc alias-init)"  # Automatically configures all aliasable commands

# Now use them directly
gen uuid                 # Runs: rc gen uuid
npm ss                   # Runs: rc npm ss (custom command)
npm install react       # Runs: system npm install react (passes through)
```

**How it works**: 
- `rc alias <command>` creates intelligent wrapper scripts that route custom commands to rc and pass unknown commands to system binaries
- `rc alias-init` discovers all aliasable directories and outputs shell aliases to set them all up at once
- Wrappers automatically detect whether a command is custom (handled by rc) or standard (passed to system)

**Perfect for**:
- **Command extension**: Add custom commands to existing tools (like npm, git, docker)
- **Seamless workflow**: Custom commands feel native, standard commands work unchanged  
- **Team productivity**: Share enhanced tooling without breaking existing workflows
- **One-command setup**: `eval "$(rc alias-init)"` configures everything automatically

## 🔀 Command Wrapping & Extension

Extend existing command-line tools by creating rc extensions that add functionality while preserving original behavior.

### Example: Extending npm

Create a comprehensive npm extension that adds custom commands while passing through standard npm functionality:

```bash
# 1. Create npm extension directory
mkdir -p ~/.local/share/rc/extensions/npm

# 2. Add custom commands with aliases
cat > ~/.local/share/rc/extensions/npm/show-scripts.yaml << 'EOF'
description: Show available npm scripts in a nice format
runner: bash
aliases:
  - ss
EOF

cat > ~/.local/share/rc/extensions/npm/show-scripts.sh << 'EOF'
#!/bin/bash
echo "📦 Available npm scripts:"
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
  if (!pkg.scripts) { console.log('   No scripts found'); process.exit(0); }
  Object.entries(pkg.scripts).forEach(([name, cmd]) => {
    console.log(\`   🚀 \${name.padEnd(15)} → \${cmd}\`);
  });
"
EOF

chmod +x ~/.local/share/rc/extensions/npm/show-scripts.sh

# 3. Create npm wrapper and set up aliases
rc alias npm                    # Creates intelligent npm wrapper
eval "$(rc alias-init)"         # Sets up all aliases automatically
```

**Result**: 
- `npm show-scripts` / `npm ss` - Custom enhanced command
- `npm install`, `npm run`, etc. - Pass through to real npm
- All standard npm functionality preserved
- Enhanced with custom commands and better UX
- **One command setup**: All aliases configured automatically

### How Command Wrapping Works

1. **Extension Discovery**: rc finds your custom commands in the npm directory
2. **Wrapper Creation**: `rc alias npm` creates an intelligent wrapper script
3. **Automatic Setup**: `eval "$(rc alias-init)"` discovers and configures all wrappers
4. **Intelligent Routing**: 
   - Known custom commands → Execute your scripts via rc
   - Unknown commands → Pass through to real system binary
5. **Seamless Integration**: Works exactly like the original tool with enhanced functionality

### Use Cases

- **Enhanced git**: Add custom workflows while keeping all git commands
- **Better docker**: Add shortcuts and utilities to docker
- **Custom kubectl**: Add cluster-specific shortcuts to Kubernetes commands
- **Team tools**: Create standardized commands that extend company tools

## 🧪 Development

### Local Development

```bash
# Clone and install
git clone https://github.com/rodrigopsasaki/rodrigos-cli.git
cd rodrigos-cli
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Quick Setup for Development

```bash
# Install and setup for development
npm run setup

# Test the CLI
rc
rc help
rc gen uuid
```

### Testing Extensions

The CLI uses the `examples/extensions/` directory for testing during development. You can add your test extensions there.

### Uninstalling

```bash
# Remove the CLI
npm run uninstall

# Or manually
rm ~/.local/bin/rc
rm -rf ~/.local/bin/rodrigos-cli
```

## 🏗️ Architecture

```
src/
├── bin/rc.ts                    # Main CLI entry point
├── core/
│   ├── config-manager.ts        # XDG-aware configuration management
│   ├── extension-loader.ts      # Extension discovery & execution
│   └── completion-service.ts    # Autocomplete engine
├── types/index.ts               # TypeScript definitions
└── utils/
    ├── xdg-paths.ts            # XDG Base Directory implementation
    ├── chalk.ts                # Theme-aware styling utilities
    └── dad-joke-service.ts     # Dad joke provider
```

## 🔧 XDG Base Directory Specification

rc follows the XDG Base Directory Specification for proper file organization:

- **XDG_CONFIG_HOME**: `~/.config/rc/` (configuration files)
- **XDG_DATA_HOME**: `~/.local/share/rc/` (extensions and data)
- **XDG_CACHE_HOME**: `~/.cache/rc/` (cache files)
- **XDG_STATE_HOME**: `~/.local/state/rc/` (state files)

This ensures:
- Proper integration with Linux/Unix systems
- User control via environment variables
- Clear separation of concerns
- Standards compliance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT © [Rodrigo Sasaki](https://github.com/rodrigopsasaki)
