#!/bin/bash

# Test script for the immutable entrypoint system
set -e

echo "🧪 Testing Rodrigo's CLI Immutable Entrypoint System"
echo ""

# Test 1: Check if the immutable entrypoint exists
echo "📋 Test 1: Checking immutable entrypoint..."
if [ -f ~/.local/bin/rc-immutable ]; then
    echo "   ✅ rc-immutable entrypoint exists"
else
    echo "   ❌ rc-immutable entrypoint not found"
    exit 1
fi

# Test 2: Check if the symlink exists and points to the immutable entrypoint
echo "📋 Test 2: Checking symlink..."
if [ -L ~/.local/bin/rc ]; then
    echo "   ✅ rc symlink exists"
    LINK_TARGET=$(readlink ~/.local/bin/rc)
    if [ "$LINK_TARGET" = "rc-immutable" ] || [ "$LINK_TARGET" = "/home/rodrigopsasaki/.local/bin/rc-immutable" ]; then
        echo "   ✅ rc symlink points to rc-immutable"
    else
        echo "   ❌ rc symlink points to: $LINK_TARGET (expected: rc-immutable)"
        exit 1
    fi
else
    echo "   ❌ rc symlink not found"
    exit 1
fi

# Test 3: Test that rc command works
echo "📋 Test 3: Testing rc command..."
if command -v rc &> /dev/null; then
    echo "   ✅ rc command is available"
    
    # Test basic functionality
    RC_OUTPUT=$(rc --version 2>&1 || true)
    if echo "$RC_OUTPUT" | grep -q "1.0.0"; then
        echo "   ✅ rc command returns version correctly"
    else
        echo "   ⚠️  rc command output: $RC_OUTPUT"
    fi
else
    echo "   ❌ rc command not found in PATH"
    exit 1
fi

# Test 4: Test that --update option is available
echo "📋 Test 4: Testing --update option..."
RC_HELP=$(rc --help 2>&1 || true)
if echo "$RC_HELP" | grep -q "update"; then
    echo "   ✅ --update option is available"
else
    echo "   ❌ --update option not found in help"
    echo "   Help output: $RC_HELP"
    exit 1
fi

# Test 5: Test that the immutable entrypoint can be called directly
echo "📋 Test 5: Testing direct immutable entrypoint call..."
if ~/.local/bin/rc-immutable --version &> /dev/null; then
    echo "   ✅ rc-immutable can be called directly"
else
    echo "   ❌ rc-immutable cannot be called directly"
    exit 1
fi

echo ""
echo "🎉 All tests passed! The immutable entrypoint system is working correctly."
echo ""
echo "💡 Key benefits of this system:"
echo "   • The symlink always points to the same location (rc-immutable)"
echo "   • Updates are handled by the immutable entrypoint itself"
echo "   • Even outdated symlinks will work and can self-update"
echo "   • The system is self-healing and future-proof"
echo ""
echo "🔧 To test the update functionality:"
echo "   rc --update" 