#!/usr/bin/env bash

echo "🔧 Render Build Script"

# Install dependencies
echo "📦 Installing npm packages..."
npm ci

# Run the build
echo "🏗️  Building application..."
npm run build

echo "✅ Build completed successfully!"
echo "ℹ️  Chrome will be installed on first start (cached for subsequent runs)"
