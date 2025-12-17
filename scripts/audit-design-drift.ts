#!/usr/bin/env npx tsx
/**
 * Design Drift Audit Script
 * 
 * Detects hardcoded Tailwind color classes in client pages
 * that should be using the design system instead.
 * 
 * Usage: npx tsx scripts/audit-design-drift.ts [--strict]
 * 
 * --strict: Exit with code 1 if any drift is found
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

interface Finding {
  file: string;
  line: number;
  content: string;
  pattern: string;
  severity: 'warning' | 'error';
}

// Patterns that indicate potential design drift
const DRIFT_PATTERNS = [
  // Status colors that should use design system
  { regex: /\bbg-green-\d+\b/g, name: 'bg-green-*', severity: 'warning' as const },
  { regex: /\bbg-red-\d+\b/g, name: 'bg-red-*', severity: 'warning' as const },
  { regex: /\bbg-yellow-\d+\b/g, name: 'bg-yellow-*', severity: 'warning' as const },
  { regex: /\bbg-orange-\d+\b/g, name: 'bg-orange-*', severity: 'warning' as const },
  { regex: /\bbg-blue-\d+\b/g, name: 'bg-blue-*', severity: 'warning' as const },
  { regex: /\bbg-purple-\d+\b/g, name: 'bg-purple-*', severity: 'warning' as const },
  { regex: /\bbg-teal-\d+\b/g, name: 'bg-teal-*', severity: 'warning' as const },
  
  // Text colors for statuses
  { regex: /\btext-green-\d+\b/g, name: 'text-green-*', severity: 'warning' as const },
  { regex: /\btext-red-\d+\b/g, name: 'text-red-*', severity: 'warning' as const },
  { regex: /\btext-yellow-\d+\b/g, name: 'text-yellow-*', severity: 'warning' as const },
  { regex: /\btext-orange-\d+\b/g, name: 'text-orange-*', severity: 'warning' as const },
  
  // Border colors for statuses
  { regex: /\bborder-green-\d+\b/g, name: 'border-green-*', severity: 'warning' as const },
  { regex: /\bborder-red-\d+\b/g, name: 'border-red-*', severity: 'warning' as const },
  { regex: /\bborder-yellow-\d+\b/g, name: 'border-yellow-*', severity: 'warning' as const },
  
  // Inline hex colors (major red flag)
  { regex: /#[0-9a-fA-F]{6}\b/g, name: 'Inline hex color', severity: 'error' as const },
  { regex: /#[0-9a-fA-F]{3}\b/g, name: 'Inline hex color (short)', severity: 'error' as const },
];

// Files/directories to skip
const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
];

// Files to skip (design system itself, configs, etc.)
const SKIP_FILES = [
  'design-system',
  'tailwind.config',
  'index.css',
  'globals.css',
  '.test.',
  '.spec.',
];

// Skip patterns within file content (comments, config objects)
const SKIP_CONTENT_PATTERNS = [
  /\/\*[\s\S]*?\*\//g,  // Multi-line comments
  /\/\/.*$/gm,          // Single-line comments
];

function shouldSkipFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  return SKIP_FILES.some(skip => normalizedPath.includes(skip.toLowerCase()));
}

function shouldSkipDir(dirName: string): boolean {
  return SKIP_DIRS.includes(dirName);
}

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Skip comment lines
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        return;
      }
      
      // Skip import lines
      if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('export ')) {
        return;
      }
      
      DRIFT_PATTERNS.forEach(pattern => {
        const matches = line.match(pattern.regex);
        if (matches) {
          matches.forEach(match => {
            findings.push({
              file: filePath,
              line: index + 1,
              content: trimmedLine.substring(0, 100) + (trimmedLine.length > 100 ? '...' : ''),
              pattern: pattern.name,
              severity: pattern.severity,
            });
          });
        }
      });
    });
  } catch (err) {
    // Skip files that can't be read
  }
  
  return findings;
}

function scanDirectory(dir: string): Finding[] {
  const findings: Finding[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldSkipDir(entry)) {
          findings.push(...scanDirectory(fullPath));
        }
      } else if (stat.isFile()) {
        // Only scan TypeScript/JavaScript files
        if ((entry.endsWith('.tsx') || entry.endsWith('.ts') || entry.endsWith('.jsx') || entry.endsWith('.js')) 
            && !shouldSkipFile(fullPath)) {
          findings.push(...scanFile(fullPath));
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}:`, err);
  }
  
  return findings;
}

function formatFindings(findings: Finding[]): void {
  if (findings.length === 0) {
    console.log('\n✅ No design drift detected!\n');
    return;
  }
  
  console.log(`\n⚠️  Found ${findings.length} potential design drift issues:\n`);
  
  // Group by file
  const byFile = new Map<string, Finding[]>();
  findings.forEach(f => {
    const key = f.file;
    if (!byFile.has(key)) {
      byFile.set(key, []);
    }
    byFile.get(key)!.push(f);
  });
  
  byFile.forEach((fileFindings, file) => {
    const relPath = relative(process.cwd(), file);
    console.log(`📁 ${relPath}`);
    
    fileFindings.forEach(f => {
      const icon = f.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} Line ${f.line}: ${f.pattern}`);
      console.log(`      ${f.content}`);
    });
    console.log('');
  });
  
  // Summary
  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  
  console.log('─'.repeat(60));
  console.log(`Summary: ${errors} errors, ${warnings} warnings`);
  console.log('');
  console.log('Recommendations:');
  console.log('  - Replace status color classes with design system components');
  console.log('  - Use <ProjectStageBadge>, <TaskStatusBadge>, etc.');
  console.log('  - Use getXXXClasses() from @shared/design/semantics');
  console.log('  - Remove inline hex colors, use design tokens');
  console.log('');
}

// Main
const isStrict = process.argv.includes('--strict');
const targetDir = join(process.cwd(), 'client/src/pages');

console.log('🔍 Scanning for design drift in client/src/pages...');

const findings = scanDirectory(targetDir);
formatFindings(findings);

if (isStrict && findings.length > 0) {
  const errors = findings.filter(f => f.severity === 'error').length;
  if (errors > 0) {
    console.log('❌ Strict mode: Exiting with code 1 due to errors');
    process.exit(1);
  }
}

console.log('✨ Audit complete');
