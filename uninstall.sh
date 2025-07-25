#!/bin/bash

# Rodrigo's CLI Uninstaller
set -e

echo "🗑️  Uninstalling Rodrigo's CLI..."

# Remove the symlink
if [ -L ~/.local/bin/rc ]; then
    rm ~/.local/bin/rc
    echo "✅ Removed rc CLI symlink"
else
    echo "ℹ️  rc CLI symlink not found"
fi

# Check if the CLI is still available
if command -v rc &> /dev/null; then
    echo "⚠️  rc command is still available. It might be installed elsewhere."
else
    echo "✅ rc CLI successfully uninstalled"
fi

echo ""
echo "🎉 Uninstallation complete!" 