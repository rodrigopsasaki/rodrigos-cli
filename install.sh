#!/bin/bash

# Rodrigo's CLI Installer
set -e

echo "🚀 Installing Rodrigo's CLI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed. Please install npm first."
    exit 1
fi

# Install dependencies and build
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the CLI..."
npm run build

# Make the binary executable
echo "🔧 Making binary executable..."
chmod +x dist/bin/rc.js

# Create symlink in user's local bin
echo "🔗 Creating symlink..."
mkdir -p ~/.local/bin
ln -sf "$(pwd)/dist/bin/rc.js" ~/.local/bin/rc

# Test the installation
if command -v rc &> /dev/null; then
    echo "✅ Installation successful!"
    echo ""
    echo "🎉 Rodrigo's CLI is now available as 'rc'"
    echo ""
    echo "Try these commands:"
    echo "  rc                    # Show a dad joke"
    echo "  rc help              # Show available commands"
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