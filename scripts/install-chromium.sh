#!/bin/bash

# Install Chromium for Puppeteer in production environments
# This script should be run during the build process

echo "📦 Installing Chromium for Puppeteer..."

# Install Chromium using Puppeteer's browser installer
npx puppeteer browsers install chrome

# Check if installation was successful
if [ $? -eq 0 ]; then
  echo "✅ Chromium installed successfully"
else
  echo "❌ Failed to install Chromium"
  exit 1
fi
