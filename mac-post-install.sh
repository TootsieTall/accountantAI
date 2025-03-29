#!/bin/bash
# Post-install script for macOS
# This script will run after the app is installed

# Get the app's bundle path
APP_PATH="/Applications/AccountantAI Uploader.app"
APP_EXECUTABLE="$APP_PATH/Contents/MacOS/AccountantAI Uploader"

# Make sure the app has execute permissions
chmod +x "$APP_EXECUTABLE"

# Run the app with the initialization flag
"$APP_EXECUTABLE" --initialize-data-directory &

# Exit with success
exit 0
