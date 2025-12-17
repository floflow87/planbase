/**
 * Script to detect hardcoded configuration options in the codebase
 * 
 * This script scans client/src/**\/*.{ts,tsx} for patterns that indicate
 * hardcoded options that should be using the Config Registry instead.
 * 
 * Usage: npx tsx scripts/check-hardcoded-options.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
}

const PATTERNS: { regex: RegExp; description: string }[] = [
  {
    regex: /const\s+(stages|statuses|priorities|options)\s*=\s*\[/,
    description: 'Hardcoded array definition for stages/statuses/priorities/options',
  },
  {
    regex: /<SelectItem[^>]+value=["'][^"']*["']/,
    description: 'SelectItem with hardcoded value',
  },
  {
    regex: /z\.enum\(\s*\[/,
    description: 'Zod enum with hardcoded values',
  },
  {
    regex: /switch\s*\(\s*(status|stage|priority)\s*\)/,
    description: 'Switch statement on status/stage/priority',
  },
];

const EXCLUSION_COMMENT = '// hardcode-ok';

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...getAllFiles(fullPath, extensions));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';
    
    // Skip if previous line contains exclusion comment
    if (prevLine.includes(EXCLUSION_COMMENT)) {
      continue;
    }
    
    // Skip if current line contains exclusion comment
    if (line.includes(EXCLUSION_COMMENT)) {
      continue;
    }
    
    // Skip files in shared/config (they ARE the source of truth)
    if (filePath.includes('shared/config')) {
      continue;
    }
    
    // Skip test files
    if (filePath.includes('.test.')) {
      continue;
    }
    
    for (const { regex, description } of PATTERNS) {
      if (regex.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          content: line.trim().substring(0, 100),
          pattern: description,
        });
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔍 Scanning for hardcoded configuration options...\n');
  
  const clientDir = path.join(process.cwd(), 'client/src');
  const files = getAllFiles(clientDir, ['.ts', '.tsx']);
  
  console.log(`Found ${files.length} files to scan.\n`);
  
  const allViolations: Violation[] = [];
  
  for (const file of files) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }
  
  if (allViolations.length === 0) {
    console.log('✅ No hardcoded configuration options found!\n');
    console.log('All configuration should be sourced from shared/config or useConfig() hook.');
    process.exit(0);
  }
  
  console.log(`❌ Found ${allViolations.length} potential hardcoded option(s):\n`);
  
  for (const violation of allViolations) {
    console.log(`📁 ${violation.file}:${violation.line}`);
    console.log(`   Pattern: ${violation.pattern}`);
    console.log(`   Content: ${violation.content}`);
    console.log('');
  }
  
  console.log('💡 To suppress a false positive, add "// hardcode-ok" on the line before the violation.\n');
  console.log('💡 Use shared/config imports or useConfig() hook for dynamic configuration.\n');
  
  process.exit(1);
}

main();
