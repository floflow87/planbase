#!/usr/bin/env bash

echo "🔧 Render Build Script for Puppeteer"

# Install dependencies
echo "📦 Installing npm packages..."
npm ci

# Set Puppeteer cache directory to project directory (persisted on Render)
export PUPPETEER_CACHE_DIR="$PWD/.cache/puppeteer"
echo "📁 Puppeteer cache directory: $PUPPETEER_CACHE_DIR"

# Create cache directory if it doesn't exist
mkdir -p "$PUPPETEER_CACHE_DIR"

# Check if Chrome is already installed
if [[ -d "$PUPPETEER_CACHE_DIR/chrome" ]]; then
  echo "✅ Chrome already installed (using cached version)"
else
  echo "📥 Installing Chromium (this will take a moment)..."
  npx puppeteer browsers install chrome
  
  if [ $? -eq 0 ]; then
    echo "✅ Chromium installed successfully"
  else
    echo "❌ Failed to install Chromium"
    exit 1
  fi
fi

# Run the build
echo "🏗️  Building application..."
npm run build

echo "✅ Build completed successfully!"
