# 🤖 Rodrigo's CLI (rc)

A developer-first CLI framework that makes local commands feel native — like they were always part of your environment. It should feel shell-native, runtime-flexible, and composable across deeply nested command trees, with full autocomplete support and a delightful DX.

## ✨ Features

- **Zero boilerplate**: Just drop a script into a folder and it works
- **Directory-based extensions**: Recursively scan and register commands
- **Runtime-agnostic**: Support for Node.js, TypeScript, Bash, Python, Ruby, PHP
- **Sidecar configs**: Optional YAML/JSON metadata for enhanced functionality
- **Directory-level configs**: Command groups can have their own descriptions and options
- **First-class autocomplete**: Tab completion for all shells (zsh, bash, fish)
- **Debug mode**: Built-in verbose logging for troubleshooting
- **Dad jokes**: Because why not? 🎭

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

Create example extensions and configuration:

```bash
rc --setup
```

This will:

- Create your extensions directory (`~/.rc/extensions`)
- Copy example extensions
- Copy directory-level configs
- Update your configuration

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

## 📁 Extension Structure

Extensions are discovered recursively from your extensions directory:

```
~/.rc/extensions/
├── gen/
│   ├── gen.yaml              # Directory-level config
│   ├── uuid.cjs
│   ├── uuid.yaml
│   ├── objectid.sh
│   ├── objectid.yaml
│   ├── rstring.sh
│   └── rstring.yaml
├── git/
│   ├── aliases.sh
│   └── aliases.yaml
└── aws/
    ├── s3/
    │   ├── sync.sh
    │   └── sync.yaml
    └── ec2/
        ├── list.js
        └── list.yaml
```

This creates commands like:

- `rc gen uuid`
- `rc gen objectid`
- `rc gen rstring`
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
# ~/.rc/extensions/deploy.sh

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
// ~/.rc/extensions/secret.js

import { randomBytes } from "crypto";

const length = process.env.RC_LENGTH || 32;
const secret = randomBytes(parseInt(length)).toString("hex");
console.log(secret);
```

### Python Extension

```python
#!/usr/bin/bin/python3
# ~/.rc/extensions/weather.py

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

## 🛠️ Configuration

Configuration is stored following the XDG base directory spec:

```bash
# Default location
~/.config/rc/config.yaml

# Example configuration
extensionsDir: ~/.rc/extensions
defaultRunner: node
enableLogging: true
```

## 🎭 Commands

### Core Commands

- `rc` - Show configuration info and quick start commands
- `rc help` - Show all available commands recursively
- `rc completion <shell>` - Generate shell completion script
- `rc --setup` - Create example extensions and configuration
- `rc --config` - Show detailed configuration information
- `rc --joke` - Show a dad joke
- `rc --verbose` / `rc --debug` - Enable debug logging

### Extension Commands

All commands discovered from your extensions directory are automatically available with full help and autocomplete support.

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
├── bin/rc.ts              # Main CLI entry point
├── core/
│   ├── config-manager.ts  # Configuration management
│   ├── extension-loader.ts # Extension discovery & execution
│   └── completion-service.ts # Autocomplete engine
├── types/index.ts         # TypeScript definitions
└── utils/
    ├── dad-joke-service.ts # Dad joke provider
    └── chalk.ts           # Styling utilities
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Philosophy

This CLI framework follows these principles:

- **Zero boilerplate**: Just drop a script into a folder and it works
- **Shell-native**: Everything feels like it belongs in your terminal
- **Runtime-flexible**: Use whatever language you're comfortable with
- **Composable**: Build complex workflows from simple pieces
- **Delightful DX**: Autocomplete, help, and dad jokes included

---

Built with ❤️ by Rodrigo Sasaki
