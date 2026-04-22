#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { runSkillsCli } from './core/skills-cli.js';

async function preflight(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const result = await runSkillsCli(['--version']);
    if (result.exitCode !== 0) {
      return { ok: false, reason: result.stderr.trim() || 'skills cli exited non-zero' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

const check = await preflight();
if (!check.ok) {
  console.error('skills-gov: cannot find a working `skills` CLI');
  console.error(`reason: ${check.reason}`);
  console.error('install it with: npm i -g skills');
  process.exit(1);
}

render(React.createElement(App));
