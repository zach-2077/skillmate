import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  signal?: AbortSignal;
  cwd?: string;
}

function resolveBin(): { cmd: string; prefix: string[] } {
  const local = join(process.cwd(), 'node_modules', '.bin', 'skills');
  if (existsSync(local)) return { cmd: local, prefix: [] };
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
