// Builds what the published plugin runs: the UI into ui/dist and the server and MCP into single files with their dependencies inside.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', 'ui'], { cwd: ROOT, stdio: 'inherit' });

const banner = { js: "import { createRequire as __kinoraRequire } from 'node:module'; const require = __kinoraRequire(import.meta.url); globalThis.KINORA_BUNDLE = true;" };
for (const [from, to] of [['server/index.js', 'server/kinora-server.js'], ['server/mcp.js', 'server/kinora-mcp.js']]) {
  await build({ entryPoints: [path.join(ROOT, from)], outfile: path.join(ROOT, to), bundle: true, platform: 'node', format: 'esm', target: 'node20', external: ['vite'], banner, legalComments: 'none', logLevel: 'warning' });
  console.log('built', to);
}
