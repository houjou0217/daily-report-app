import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const targets = [
  'src',
  'package.json',
  'forge.config.ts',
  'tsconfig.webpack.json',
  'webpack.main.config.ts',
  'webpack.renderer.config.ts',
  'webpack.rules.ts',
];

const forbiddenPatterns = [
  { label: 'HTTP URL', expression: /https?:\/\//giu },
  { label: 'fetch', expression: /fetch\s*\(/giu },
  { label: 'axios', expression: /axios/giu },
  { label: 'XMLHttpRequest', expression: /XMLHttpRequest/gu },
  { label: 'WebSocket', expression: /WebSocket/gu },
  { label: 'EventSource', expression: /EventSource/gu },
  { label: 'sendBeacon', expression: /sendBeacon/gu },
  { label: 'autoUpdater', expression: /autoUpdater/gu },
  { label: 'crashReporter', expression: /crashReporter/gu },
  { label: 'Google Fonts', expression: /Google\s+Fonts/giu },
  { label: 'CDN reference', expression: /\bcdn\b/giu },
];

// Add an allowlist entry only for a known-safe literal and document its reason here.
const allowlistedMatches = new Map();

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );

  return nestedFiles.flat();
};

const collectTargetFiles = async () => {
  const files = [];

  for (const target of targets) {
    const targetPath = join(rootDirectory, target);
    const targetStats = await stat(targetPath);

    if (targetStats.isDirectory()) {
      files.push(...(await collectFiles(targetPath)));
    } else {
      files.push(targetPath);
    }
  }

  return files;
};

const scanFile = async (fileUrl) => {
  const content = await readFile(fileUrl, 'utf8');
  const relativePath = relative(rootDirectory, fileUrl);
  const findings = [];

  for (const { label, expression } of forbiddenPatterns) {
    expression.lastIndex = 0;

    for (const match of content.matchAll(expression)) {
      const offset = match.index ?? 0;
      const line = content.slice(0, offset).split('\n').length;
      const key = `${relativePath}:${line}:${match[0]}`;
      const reason = allowlistedMatches.get(key);

      if (reason === undefined) {
        findings.push(`${relativePath}:${line} ${label} (${match[0]})`);
      }
    }
  }

  return findings;
};

const files = await collectTargetFiles();
const findings = (await Promise.all(files.map(scanFile))).flat();

if (findings.length > 0) {
  console.error('通信禁止チェックに失敗しました。');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log('通信禁止チェックに合格しました。');
}
