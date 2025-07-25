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

# Create user's local bin directory
echo "📁 Creating installation directory..."
mkdir -p ~/.local/bin

# Get the latest version
echo "📥 Getting latest version..."
LATEST_VERSION=$(curl -s https://api.github.com/repos/rodrigopsasaki/rodrigos-cli/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
    echo "⚠️  Could not determine latest version. Installing from main branch..."
    LATEST_VERSION="main"
fi

echo "📦 Installing version $LATEST_VERSION..."

# Clone and build locally
TEMP_DIR=$(mktemp -d)
echo "📁 Creating temporary directory: $TEMP_DIR"

git clone https://github.com/rodrigopsasaki/rodrigos-cli.git "$TEMP_DIR"
cd "$TEMP_DIR"

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

echo "🔧 Creating wrapper script..."
cat > ~/.local/bin/rc << 'EOF'
#!/bin/bash
# Wrapper script for Rodrigo's CLI
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$SCRIPT_DIR/rodrigos-cli"

# If CLI directory doesn't exist, create it
if [ ! -d "$CLI_DIR" ]; then
    echo "❌ CLI installation not found. Please run the installer again."
    exit 1
fi

# Run the CLI with tsx
cd "$CLI_DIR"
npx tsx src/bin/rc.ts "$@"
EOF

chmod +x ~/.local/bin/rc

echo "📁 Installing CLI files..."
mkdir -p ~/.local/bin/rodrigos-cli
cp -r src ~/.local/bin/rodrigos-cli/
cp package.json ~/.local/bin/rodrigos-cli/
cp tsconfig.json ~/.local/bin/rodrigos-cli/
cp -r node_modules ~/.local/bin/rodrigos-cli/

echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"

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