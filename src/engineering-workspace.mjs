// Deliberately narrow admission policy for fictional local Git fixtures, NOT a sandbox.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const invalid = () => { throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST' }); };
const inside = (root, path) => {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};
export const engineeringTestPolicy = 'node-test-only-v1';
export const engineeringInstructions = `Controlled engineering test on fictional disposable data only.
Stay inside the supplied workspace. Use read/edit/write for files, bash only for local inspection
and the harmless test command node --test. No package installation, network, remote Git,
Git writes (including commit/push/config), credentials, external context or external files.
The approved test policy is node-test-only-v1: existing local Node built-in tests, no dependencies.
The workspace marker is an attestation, not a security sandbox. Do not claim task approval.`;

/** Keep provider configuration, but do not forward Git/SSH credential/config overrides. */
export function engineeringEnvironment(source = process.env) {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) =>
    !/^(GIT_|GCM_|SSH_|GITHUB_|GH_|GITLAB_|BITBUCKET_)/iu.test(key)));
  // Git for Windows accepts /dev/null, not Node's Windows os.devNull (\\\\.\\nul).
  return { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'core.hooksPath', GIT_CONFIG_VALUE_1: '/dev/null' };
}

/** Internal read-only checks: literal argument lists below, never request commands. */
function inspectEngineeringGit(workspace, args) {
  return execFileSync('git', ['--no-optional-locks', '-C', workspace, ...args], {
    shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 256 * 1024,
    encoding: 'utf8', env: engineeringEnvironment(), stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function validateEngineeringWorkspace(workspace, policy) {
  try {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy) ||
        Object.keys(policy).sort().join(',') !== 'baseline,branch,testPolicy' ||
        !/^[a-f0-9]{40}$/u.test(policy.baseline) ||
        typeof policy.branch !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_/-]{0,63}$/u.test(policy.branch) ||
        policy.testPolicy !== engineeringTestPolicy) invalid();
    if (typeof workspace !== 'string' || !isAbsolute(workspace) ||
        (process.platform === 'win32' && (!/^[a-z]:\\/iu.test(workspace) || workspace.slice(2).includes(':')))) invalid();
    const actual = realpathSync(workspace), temp = realpathSync(tmpdir());
    if (!inside(temp, actual) || actual === temp || inside(repository, actual) ||
        lstatSync(workspace).isSymbolicLink() || !lstatSync(actual).isDirectory()) invalid();
    // Not a worktree/submodule of an enclosing repository.
    for (let parent = dirname(actual); ; parent = dirname(parent)) {
      if (existsSync(join(parent, '.git'))) invalid();
      if (dirname(parent) === parent) break;
    }
    const gitDir = join(actual, '.git');
    if (!lstatSync(gitDir).isDirectory()) invalid();
    let entries = 0, bytes = 0;
    const pending = [actual];
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name), info = lstatSync(path), name = entry.name.toLowerCase();
        if (++entries > 4096 || info.isSymbolicLink() || (info.nlink > 1 && info.isFile()) ||
            (!info.isDirectory() && !info.isFile()) ||
            ['.pi', '.openclaw', '.ssh', '.aws', '.azure', '.netrc', '_netrc', '.npmrc',
              '.git-credentials', 'credentials', 'credentials.json', 'auth.json', 'id_rsa', 'id_ed25519', 'node_modules'].includes(name) ||
            /^\.env(?:\.|$)|\.(?:pem|key|pfx|p12)$/iu.test(name) ||
            (name === '.git' && path !== gitDir)) invalid();
        if (info.isDirectory()) pending.push(path);
        else { bytes += info.size; if (info.size > 8 * 1024 * 1024 || bytes > 32 * 1024 * 1024) invalid(); }
      }
    }
    if (lstatSync(join(actual, '.devout-disposable.json')).size > 1024 ||
        !lstatSync(join(actual, 'test', 'fixture.test.mjs')).isFile()) invalid();
    const marker = JSON.parse(readFileSync(join(actual, '.devout-disposable.json'), 'utf8'));
    if (Object.keys(marker).sort().join(',') !== 'disposable,schemaVersion' ||
        marker.schemaVersion !== 1 || marker.disposable !== true) invalid();
    // No executable hooks, redirected object stores or shared repository metadata.
    for (const path of ['commondir', 'gitdir', 'shallow', 'objects/info/alternates', 'info/grafts', 'worktrees', 'modules', 'refs/replace']) {
      if (existsSync(join(gitDir, path))) invalid();
    }
    if (existsSync(join(gitDir, 'hooks')) && readdirSync(join(gitDir, 'hooks')).length) invalid();
    const local = inspectEngineeringGit(actual, ['config', '--local', '--no-includes', '--null', '--list']);
    const allowed = new Map([
      ['core.repositoryformatversion', /^(?:0)$/u], ['core.filemode', /^(?:true|false)$/u],
      ['core.bare', /^false$/u], ['core.logallrefupdates', /^true$/u],
      ['core.ignorecase', /^(?:true|false)$/u], ['core.symlinks', /^false$/u],
    ]);
    for (const record of local.split('\0').filter(Boolean)) {
      const split = record.indexOf('\n'), key = record.slice(0, split), value = record.slice(split + 1);
      if (split < 0 || !allowed.get(key)?.test(value)) invalid();
    }
    // Skip-worktree/assume-unchanged flags must not hide dirty content.
    if (inspectEngineeringGit(actual, ['ls-files', '-v']).split('\n').some(line => !line.startsWith('H ')) ||
        inspectEngineeringGit(actual, ['ls-files', '--stage']).split('\n').some(line => !/^100644 |^100755 /u.test(line))) invalid();
    if (inspectEngineeringGit(actual, ['rev-parse', '--show-toplevel']).replaceAll('\\', '/').toLowerCase() !==
        actual.replaceAll('\\', '/').toLowerCase() ||
        inspectEngineeringGit(actual, ['rev-parse', 'HEAD']) !== policy.baseline ||
        inspectEngineeringGit(actual, ['symbolic-ref', '--short', 'HEAD']) !== policy.branch ||
        inspectEngineeringGit(actual, ['remote']) !== '' ||
        inspectEngineeringGit(actual, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored']) !== '') invalid();
    return actual;
  } catch { invalid(); }
}
