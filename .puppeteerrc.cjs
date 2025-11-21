/**
 * Puppeteer Configuration
 * - Replit (dev): Uses PUPPETEER_EXECUTABLE_PATH env var (Nix Chromium)
 * - Render (prod): Uses default cache directory (~/.cache/puppeteer)
 */
const { join } = require('path');
const os = require('os');

// Only configure cacheDirectory if NOT using custom executable path
// This allows Replit to use PUPPETEER_EXECUTABLE_PATH without conflicts
module.exports = process.env.PUPPETEER_EXECUTABLE_PATH
  ? {} // Empty config on Replit - let executablePath env var take precedence
  : {
      // On Render (no PUPPETEER_EXECUTABLE_PATH), use persistent cache
      cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
    };
