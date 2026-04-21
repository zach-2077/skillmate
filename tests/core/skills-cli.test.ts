import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

const spawnMock = vi.fn();
vi.mock('child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));

import { runSkillsCli } from '../../src/core/skills-cli.js';

function fakeChild(opts: { stdout?: string; stderr?: string; exitCode?: number }) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: Readable;
    stderr: Readable;
    kill: (signal?: string) => void;
  };
  child.stdout = Readable.from([opts.stdout ?? '']);
  child.stderr = Readable.from([opts.stderr ?? '']);
  child.kill = vi.fn();
  setImmediate(() => child.emit('close', opts.exitCode ?? 0));
  return child;
}

describe('runSkillsCli', () => {
  beforeEach(() => spawnMock.mockReset());

  it('captures stdout, stderr, and exit code', async () => {
    spawnMock.mockReturnValue(fakeChild({ stdout: 'hello', stderr: 'warn', exitCode: 0 }));
    const result = await runSkillsCli(['list', '--json']);
    expect(result).toEqual({ exitCode: 0, stdout: 'hello', stderr: 'warn' });
    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringMatching(/(skills|npx)/),
      expect.arrayContaining(['list', '--json']),
      expect.any(Object),
    );
  });

  it('propagates non-zero exit code', async () => {
    spawnMock.mockReturnValue(fakeChild({ stderr: 'boom', exitCode: 2 }));
    const result = await runSkillsCli(['add', 'foo']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('boom');
  });

  it('aborts via signal', async () => {
    const controller = new AbortController();
    const child = fakeChild({});
    spawnMock.mockReturnValue(child);
    const promise = runSkillsCli(['add', 'foo'], { signal: controller.signal });
    controller.abort();
    await promise;
    expect(child.kill).toHaveBeenCalled();
  });
});
