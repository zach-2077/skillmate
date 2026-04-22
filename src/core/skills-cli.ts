import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { createRequire } from 'module';

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  signal?: AbortSignal;
  cwd?: string;
}

const _require = createRequire(import.meta.url);

export function resolveBin(): { cmd: string; prefix: string[] } {
  try {
    const pkgPath = _require.resolve('skills/package.json');
    const pkg = _require('skills/package.json') as { bin?: Record<string, string> | string };
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.skills;
    if (binRel) {
      const binPath = join(dirname(pkgPath), binRel);
      if (existsSync(binPath)) return { cmd: process.execPath, prefix: [binPath] };
    }
  } catch {
    // bundled dep unresolvable; fall through to npx
  }
  return { cmd: 'npx', prefix: ['skills'] };
}

export async function runSkillsCli(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const { cmd, prefix } = resolveBin();
  return new Promise((resolve) => {
    const child = spawn(cmd, [...prefix, ...args], {
      cwd: opts.cwd ?? process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

    const onAbort = () => child.kill('SIGINT');
    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });

    child.on('close', (code) => {
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });

    child.on('error', (err: Error) => {
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      resolve({ exitCode: 1, stdout: '', stderr: err.message });
    });
  });
}
