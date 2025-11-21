/**
 * Puppeteer Configuration for Render deployment
 * This ensures Chromium is installed in a persistent location within the project
 */
const { join } = require('path');

module.exports = {
  // Cache directory for Chromium (persists across builds on Render)
  // This matches PUPPETEER_CACHE_DIR in render-build.sh
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
