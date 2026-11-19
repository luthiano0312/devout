import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { engineeringEnvironment, validateEngineeringWorkspace } from '../engineering-workspace.mjs';
import { windowsLaunchSpec } from '../pi-driver.mjs';
import { runRole, validateRequest } from '../role-runner.mjs';
import { prepareEngineeringFixture } from './helpers/engineering-fixture.mjs';
const windows = { skip: process.platform !== 'win32', timeout: 30_000 };
const invalid = error => error.code === 'INVALID_REQUEST';
function setup(t) {
  const fixture = prepareEngineeringFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const piCmd = join(fixture.root, 'pi.cmd'); writeFileSync(piCmd, '@echo off\r\n');
  return { ...fixture, config: { schemaVersion: 1, taskId: 'M02-T01-TEST', role: 'test',
    workspace: fixture.workspace, engineering: fixture.engineering,
    modelProfile: 'configured-engineering', piCmd, artifactsRoot: join(fixture.root, 'artifacts'),
    prompt: 'Fictional test only. Respond PONG.', expectedText: 'PONG' } };
}

test('engineering environment removes Git/SSH overrides and broad Git token variables', () => {
  const env = engineeringEnvironment({ PATH: 'retained', OPENAI_API_KEY: 'provider',
    GIT_DIR: 'bad', git_config_count: '100', GIT_CONFIG_KEY_0: 'include.path',
    SSH_AUTH_SOCK: 'bad', GITHUB_TOKEN: 'bad', GH_TOKEN: 'bad', GCM_CREDENTIAL_STORE: 'bad' });
  assert.equal(env.PATH, 'retained'); assert.equal(env.OPENAI_API_KEY, 'provider');
  for (const name of ['GIT_DIR', 'git_config_count', 'SSH_AUTH_SOCK', 'GITHUB_TOKEN', 'GH_TOKEN', 'GCM_CREDENTIAL_STORE']) {
    assert.equal(env[name], undefined);
  }
  assert.equal(env.GIT_CONFIG_GLOBAL, '/dev/null'); assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0'); assert.equal(env.GIT_CONFIG_VALUE_0, '');
});

test('admits only clean prepared fictional Git baseline with explicit test policy', t => {
  const { workspace, engineering } = setup(t);
  assert.equal(validateEngineeringWorkspace(workspace, engineering), workspace);
  for (const policy of [undefined, {}, { ...engineering, extra: true }, { ...engineering, branch: 'other' },
    { ...engineering, baseline: '0'.repeat(40) }, { ...engineering, testPolicy: 'npm install' }]) {
    assert.throws(() => validateEngineeringWorkspace(workspace, policy), invalid);
  }
  for (const path of [tmpdir(), fileURLToPath(new URL('../..', import.meta.url)), 'relative']) {
    assert.throws(() => validateEngineeringWorkspace(path, engineering), invalid);
  }
  writeFileSync(join(workspace, 'value.mjs'), 'export const value = 2;\n');
  assert.throws(() => validateEngineeringWorkspace(workspace, engineering), invalid);
});

for (const [name, mutate] of [
  ['remote', f => f.git(['remote', 'add', 'origin', 'https://example.invalid/fake'])],
  ['credential helper', f => f.git(['config', 'credential.helper', 'manager'])],
  ['include', f => f.git(['config', 'include.path', join(f.root, 'external')])],
  ['shell alias', f => f.git(['config', 'alias.test', '!echo BAD'])],
  ['fsmonitor', f => f.git(['config', 'core.fsmonitor', 'BAD'])],
  ['hook', f => { mkdirSync(join(f.workspace, '.git', 'hooks')); writeFileSync(join(f.workspace, '.git', 'hooks', 'pre-commit'), 'BAD'); }],
  ['alternates', f => writeFileSync(join(f.workspace, '.git', 'objects', 'info', 'alternates'), '/outside')],
  ['shared metadata', f => writeFileSync(join(f.workspace, '.git', 'commondir'), '/outside')],
  ['untracked file', f => writeFileSync(join(f.workspace, 'extra.txt'), 'fictional')],
  ['ignored file', f => { mkdirSync(join(f.workspace, '.git', 'info')); writeFileSync(join(f.workspace, '.git', 'info', 'exclude'), 'ignored.txt'); writeFileSync(join(f.workspace, 'ignored.txt'), 'fictional'); }],
  ['assume-unchanged', f => f.git(['update-index', '--assume-unchanged', 'value.mjs'])],
  ['skip-worktree', f => f.git(['update-index', '--skip-worktree', 'value.mjs'])],
  ['credential file', f => writeFileSync(join(f.workspace, '.env'), 'FICTIONAL=1')],
  ['Pi history', f => mkdirSync(join(f.workspace, '.pi'))],
  ['missing marker', f => rmSync(join(f.workspace, '.devout-disposable.json'))],
  ['missing test', f => rmSync(join(f.workspace, 'test', 'fixture.test.mjs'))],
  ['nested Git', f => mkdirSync(join(f.workspace, 'test', '.git'))],
  ['hardlink', f => linkSync(join(f.workspace, 'value.mjs'), join(f.workspace, 'linked.mjs'))],
]) {
  test(`rejects ${name} before launcher, with no Pi or artifacts`, windows, async t => {
    const f = setup(t); mutate(f);
    assert.throws(() => validateRequest(f.config), invalid);
    let acquired = false;
    await assert.rejects(runRole(f.config, { acquire: async () => { acquired = true; } }), invalid);
    assert.equal(acquired, false);
    assert.equal(existsSync(f.config.artifactsRoot), false);
  });
}

test('rejects linked workspaces/metadata and internal junctions', windows, t => {
  const f = setup(t);
  const alias = join(f.root, 'alias'); symlinkSync(f.workspace, alias, 'junction');
  assert.throws(() => validateRequest({ ...f.config, workspace: alias }), invalid);
  symlinkSync(f.root, join(f.workspace, 'external'), 'junction');
  assert.throws(() => validateRequest(f.config), invalid);
  rmSync(join(f.workspace, 'external'), { recursive: true });
  rmSync(join(f.workspace, '.git'), { recursive: true });
  writeFileSync(join(f.workspace, '.git'), 'gitdir: elsewhere');
  assert.throws(() => validateRequest(f.config), invalid);
});

test('closed request and literal launcher preserve M01 while allowing engineering tools only', windows, t => {
  const f = setup(t), input = f.config;
  assert.equal(validateRequest(input).modelProfile, 'configured-engineering');
  const spec = windowsLaunchSpec({ piCmd: input.piCmd, cwd: input.workspace, profile: 'engineering', engineering: input.engineering });
  assert.equal(spec.options.shell, false);
  assert.match(spec.args.at(-1), /--tools read,edit,write,bash /u);
  for (const flag of ['--no-session', '--no-extensions', '--no-mcp', '--no-skills', '--no-prompt-templates', '--no-context-files', '--no-approve']) {
    assert.ok(spec.args.at(-1).includes(flag));
  }
  assert.equal(spec.options.env.GIT_CONFIG_GLOBAL, '/dev/null');
  assert.match(windowsLaunchSpec({ piCmd: input.piCmd, cwd: input.workspace, profile: 'isolated' }).args.at(-1), /--no-tools/u);
  for (const change of [{ role: 'implementador' }, { modelProfile: 'arbitrary' }, { engineering: undefined },
    { modelProfile: 'configured-isolated' }, { command: 'whoami' }, { tools: 'bash' },
    { artifactsRoot: join(input.workspace, 'runs') }, { driver: { shell: true } },
    { piCmd: input.piCmd + ' & whoami' }]) {
    assert.throws(() => validateRequest({ ...input, ...change }), invalid);
  }
  assert.throws(() => windowsLaunchSpec({ piCmd: input.piCmd, cwd: input.workspace, profile: 'engineering' }), invalid);
});

function fakeLease(f, calls, toolEvents = []) {
  const driver = new EventEmitter();
  driver.getState = async () => ({ id: 'rpc', command: 'get_state', success: true,
    data: { model: { id: 'configured' }, isStreaming: false } });
  driver.promptAndWait = async prompt => {
    assert.match(prompt, /No package installation/u); assert.match(prompt, /node-test-only-v1/u);
    calls.push('prompt');
    for (const event of toolEvents) driver.emit('event', event);
    driver.emit('event', { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'PONG' }] } });
    return { response: { success: true, data: { disposition: 'started' } }, settled: { type: 'agent_settled' }, assistantError: false };
  };
  return { launch: async options => {
    calls.push('launch'); assert.equal(options.profile, 'engineering'); assert.deepEqual(options.engineering, f.engineering); return driver;
  }, finish: async () => {
    calls.push('finish'); return { released: true, termination: { state: 'terminated', canRelease: true,
      processesGone: true, workCompleted: true, forced: false, exitCode: 0 } };
  } };
}

test('engineering test role uses existing lifecycle and release without official task approval', windows, async t => {
  const f = setup(t), calls = [];
  const result = await runRole(f.config, { acquire: async () => { calls.push('acquire'); return fakeLease(f, calls); } });
  assert.deepEqual(calls, ['acquire', 'launch', 'prompt', 'finish']);
  assert.equal(result.result.taskApproved, false); assert.equal(result.result.lock.released, true);
  assert.equal(result.result.technicalOutcome, 'succeeded');
  assert.equal(f.git(['rev-parse', 'HEAD']), f.engineering.baseline);
});

for (const [name, command, endId, isError, success] of [
  ['correlated success', 'node --test', 'test-call', false, true],
  ['different command', 'node --test && echo extra', 'test-call', false, false],
  ['uncorrelated end', 'node --test', 'other-call', false, false],
  ['tool failure', 'node --test', 'test-call', true, false],
]) {
  test(`engineering smoke receipt: ${name}`, windows, async t => {
    const f = setup(t);
    const toolEvents = [
      { type: 'tool_execution_start', toolName: 'bash', toolCallId: 'test-call', args: { command } },
      { type: 'tool_execution_end', toolName: 'bash', toolCallId: endId, isError, result: 'DO-NOT-PERSIST-TOOL-CONTENT' },
    ];
    const result = await runRole(f.config, { acquire: async () => fakeLease(f, [], toolEvents) });
    assert.equal(result.result.observed.engineering.harmlessTestSucceeded, success);
    assert.equal(result.result.observed.engineering.toolStarts, 1);
    assert.equal(result.result.observed.engineering.toolEnds, 1);
    assert.ok(!JSON.stringify(result.result).includes('DO-NOT-PERSIST'));
  });
}

test('revalidates admission after acquiring lease; mutation prevents launch and releases empty lease', windows, async t => {
  const f = setup(t), calls = [];
  const result = await runRole(f.config, { acquire: async () => {
    writeFileSync(join(f.workspace, '.env'), 'FICTIONAL=1'); calls.push('acquire'); return fakeLease(f, calls);
  } });
  assert.deepEqual(calls, ['acquire', 'finish']);
  assert.equal(result.result.technicalOutcome, 'failed'); assert.equal(result.result.lock.released, true);
});
