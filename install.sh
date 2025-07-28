#!/bin/bash

# Rodrigo's CLI Installer
set -e

echo "🚀 Installing Rodrigo's CLI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js first."
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ git is required but not installed. Please install git first."
    exit 1
fi

# Create user's local bin directory and XDG-compliant source directory
echo "📁 Creating installation directories..."
mkdir -p ~/.local/bin
mkdir -p ~/.local/share/rc

# Get the latest version
echo "📥 Getting latest version..."
LATEST_VERSION=$(curl -s https://api.github.com/repos/rodrigopsasaki/rodrigos-cli/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
    echo "⚠️  Could not determine latest version. Installing from main branch..."
    LATEST_VERSION="main"
fi

echo "📦 Installing version $LATEST_VERSION..."

# Use XDG-compliant source directory
SOURCE_DIR="$HOME/.local/share/rc/source"

# Check if we're in a development environment (local git repo)
if [ -d ".git" ] && [ -f "package.json" ]; then
    echo "📁 Development environment detected, using local files..."
    TEMP_DIR=$(pwd)
    USE_LOCAL=true
else
    # Clone to the XDG-compliant source location
    echo "📁 Setting up source repository: $SOURCE_DIR"
    
    if [ -d "$SOURCE_DIR/.git" ]; then
        echo "📁 Source repository already exists, updating..."
        cd "$SOURCE_DIR"
        git fetch origin
        git reset --hard origin/main
    else
        echo "📥 Cloning repository to source location..."
        git clone https://github.com/rodrigopsasaki/rodrigos-cli.git "$SOURCE_DIR"
        cd "$SOURCE_DIR"
    fi

    # Checkout the specific version if it's not main
    if [ "$LATEST_VERSION" != "main" ]; then
        git checkout "$LATEST_VERSION"
    fi

    echo "📦 Installing dependencies..."
    npm install --no-audit --no-fund || {
        echo "⚠️  npm install failed, trying with legacy peer deps..."
        npm install --no-audit --no-fund --legacy-peer-deps || {
            echo "⚠️  npm install still failed, trying with force..."
            npm install --no-audit --no-fund --legacy-peer-deps --force
        }
    }
    
    echo "🔨 Building project..."
    npm run build
    
    TEMP_DIR="$SOURCE_DIR"
fi

echo "🔧 Creating immutable entrypoint..."
cat > ~/.local/bin/rc-immutable << 'EOF'
#!/bin/bash
# Immutable entrypoint for Rodrigo's CLI
# This script always points to the latest version and can self-update

# Use XDG-compliant source location
CLI_DIR="$HOME/.local/share/rc/source"

# If CLI directory doesn't exist, create it
if [ ! -d "$CLI_DIR" ]; then
    echo "❌ CLI source not found. Please run the installer again."
    exit 1
fi

# Run the CLI with tsx
cd "$CLI_DIR"
npx tsx src/bin/rc-immutable.ts "$@"
EOF

chmod +x ~/.local/bin/rc-immutable

echo "🔗 Creating symlink to immutable entrypoint..."
ln -sf rc-immutable ~/.local/bin/rc

# No need to copy files - they're already in the source location
echo "✅ Source repository ready at: $SOURCE_DIR"

echo "🧹 Cleaning up..."
# No cleanup needed since we use the persistent source directory

# Test the installation
if command -v rc &> /dev/null; then
    echo "✅ Installation successful!"
    echo ""
    echo "🎉 Rodrigo's CLI is now available as 'rc'"
    echo ""
    echo "Try these commands:"
    echo "  rc                    # Show configuration info"
    echo "  rc help              # Show available commands"
    echo "  rc --setup           # Create example extensions"
    echo "  rc gen uuid          # Generate a UUID"
    echo "  rc gen objectid      # Generate an ObjectID"
    echo ""
    echo "To set up shell completion:"
    echo "  eval \"\$(rc completion zsh)\"  # For zsh"
    echo "  eval \"\$(rc completion bash)\" # For bash"
    echo ""
else
    echo "❌ Installation failed. Please check your PATH includes ~/.local/bin"
    echo "Add this to your shell config: export PATH=\"\$HOME/.local/bin:\$PATH\""
    exit 1
fi 