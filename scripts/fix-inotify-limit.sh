#!/bin/bash
# Script to increase inotify watch limit on Linux
# This fixes the "OS file watch limit reached" error

echo "🔧 Fixing inotify watch limit..."

# Check current limit
CURRENT_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo "unknown")
echo "Current limit: $CURRENT_LIMIT"

# Set new limit (524288 is a common recommended value)
NEW_LIMIT=524288

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "Setting inotify limit to $NEW_LIMIT..."
    echo $NEW_LIMIT > /proc/sys/fs/inotify/max_user_watches
    echo "✅ Limit increased to $NEW_LIMIT (temporary - until reboot)"
    echo ""
    echo "To make this permanent, add this line to /etc/sysctl.conf:"
    echo "fs.inotify.max_user_watches=$NEW_LIMIT"
    echo ""
    echo "Then run: sudo sysctl -p"
else
    echo "⚠️  This script needs root privileges to change the limit."
    echo ""
    echo "To fix temporarily (until reboot), run:"
    echo "  sudo sysctl fs.inotify.max_user_watches=$NEW_LIMIT"
    echo ""
    echo "To make it permanent, run:"
    echo "  echo fs.inotify.max_user_watches=$NEW_LIMIT | sudo tee -a /etc/sysctl.conf"
    echo "  sudo sysctl -p"
    echo ""
    echo "Or run this script with sudo:"
    echo "  sudo bash scripts/fix-inotify-limit.sh"
fi

