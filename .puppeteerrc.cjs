/**
 * Puppeteer Configuration for Render deployment
 * Uses default cache directory (~/.cache/puppeteer) which is managed by Render
 */
const { join } = require('path');
const os = require('os');

module.exports = {
  // Use Render's persistent cache directory
  // On Render, this resolves to /opt/render/.cache/puppeteer
  cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
};
