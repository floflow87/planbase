/**
 * Puppeteer Configuration
 * 
 * This configuration ensures Chromium is correctly located in both:
 * - Replit (dev): Uses PUPPETEER_EXECUTABLE_PATH pointing to Nix Chromium
 * - Render (prod): Uses persistent cache at ~/.cache/puppeteer
 * 
 * The cacheDirectory is always set to ensure consistent behavior.
 * If PUPPETEER_EXECUTABLE_PATH is defined, Puppeteer will use that path
 * instead of the cached Chromium (environment variable takes precedence).
 */
const { join } = require('path');
const os = require('os');

module.exports = {
  // Always use persistent cache directory (works on both Replit and Render)
  // If PUPPETEER_EXECUTABLE_PATH env var is set, it takes precedence anyway
  cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
};
