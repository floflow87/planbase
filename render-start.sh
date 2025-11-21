#!/usr/bin/env bash

echo "🚀 Render Start Script for Puppeteer"

# Check if Chrome is installed
if ! command -v google-chrome &> /dev/null && ! command -v chromium &> /dev/null; then
  echo "📥 Chrome not found, checking Puppeteer cache..."
  
  # Check if Puppeteer Chrome exists in default cache
  if [[ ! -d "$HOME/.cache/puppeteer/chrome" ]]; then
    echo "📥 Installing Chrome for Puppeteer (first run only)..."
    npx puppeteer browsers install chrome
    
    if [ $? -eq 0 ]; then
      echo "✅ Chrome installed successfully"
    else
      echo "❌ Failed to install Chrome"
      exit 1
    fi
  else
    echo "✅ Chrome already installed (cached)"
  fi
else
  echo "✅ System Chrome found"
fi

# Start the application
echo "▶️  Starting application..."
exec npm start
