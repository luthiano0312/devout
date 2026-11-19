// Read-only admission for one approved task in a disposable fixture. NOT a sandbox.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { engineeringEnvironment, engineeringTestPolicy, validateEngineeringWorkspace } from './engineering-workspace.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const sha1 = /^[a-f0-9]{40}$/u, sha256 = /^[a-f0-9]{64}$/u;
const idPattern = /^M\d{2,}-T\d{2,}$/u;
const fields = ['Fazer', 'Não alterar', 'Entregáveis', 'Critério de conclusão'];
const states = ['não iniciada', 'em andamento', 'aguardando revisão', 'em correção', 'pausada', 'concluída', 'substituída'];
const privateNames = new Set(['.pi', '.openclaw', '.ssh', '.aws', '.azure', '.netrc', '_netrc', '.npmrc',
  '.git-credentials', 'credentials', 'credentials.json', 'auth.json', 'id_rsa', 'id_ed25519', 'node_modules']);
const header = ['Task', 'Marco', 'Status', 'Commit', 'Atualizado em', 'Observações'];
const fail = code => { throw Object.assign(new Error(code), { refusal: code }); };
const requireThat = (condition, code) => { if (!condition) fail(code); };
const exact = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) &&
  Object.keys(object).sort().join(',') === [...keys].sort().join(',');
const normalized = text => text.replaceAll('\r\n', '\n').trimEnd() + '\n';

/** Hash the complete selected task, including heading, using LF and one final newline. */
export const taskTextHash = text => digest(normalized(text));

function safePath(path, directory = false) {
  if (typeof path !== 'string' || !path || path.length > 240 || /[\\\x00-\x1f<>:"|?*]/u.test(path)) return false;
  const parts = (directory && path.endsWith('/') ? path.slice(0, -1) : path).split('/');
  return parts.every(part => part && part !== '.' && part !== '..' && !/[. ]$/u.test(part) &&
    !/^(?:\.git|con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part));
}

// Ignore code fences for structural parsing; never treat examples as task approval/table/heading.
function structure(text) {
  let fence = null;
  return text.replaceAll('\r\n', '\n').split('\n').map(line => {
    const match = /^\s{0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (fence) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
      return '';
    }
    if (match) { fence = match[1]; return ''; }
    return line;
  });
}

function mapPaths(text) {
  const lines = structure(text);
  const get = label => {
    const matches = lines.map(line => new RegExp('^- \\*\\*' + label + ':\\*\\* `([^`]+)`(?:[ .—–-]|$)', 'u').exec(line)).filter(Boolean);
    requireThat(matches.length === 1 && safePath(matches[0][1]), 'INVALID_MAP');
    return matches[0][1];
  };
  const plan = get('Plano ativo'), register = get('Registro oficial de execução');
  requireThat(plan.endsWith('/plano.md') || plan === 'plano.md', 'INVALID_MAP');
  requireThat(plan !== register, 'INVALID_MAP');
  return { plan, register };
}

function selectTask(text, taskId) {
  const raw = text.replaceAll('\r\n', '\n').split('\n'), lines = structure(text);
  requireThat(lines.filter(line => /^\*\*Status:\*\* APROVADO(?:\s|$)/u.test(line)).length === 1, 'PLAN_NOT_APPROVED');
  const starts = lines.flatMap((line, index) => {
    const match = /^### (M\d{2,}-T\d{2,}) — (\S.*)$/u.exec(line);
    return match ? [{ index, id: match[1], title: match[2] }] : [];
  });
  requireThat(new Set(starts.map(item => item.id)).size === starts.length, 'INVALID_TASK');
  const selected = starts.find(item => item.id === taskId);
  requireThat(selected, 'TASK_NOT_FOUND');
  let end = selected.index + 1;
  while (end < lines.length && !/^#{1,3} /u.test(lines[end])) end++;
  const sections = {};
  for (const field of fields) {
    const indices = [];
    for (let i = selected.index + 1; i < end; i++) if (lines[i] === `#### ${field}`) indices.push(i);
    requireThat(indices.length === 1, 'INVALID_TASK_FIELDS');
    let stop = indices[0] + 1;
    while (stop < end && !/^#{1,4} /u.test(lines[stop])) stop++;
    const body = raw.slice(indices[0] + 1, stop).join('\n').trim();
    requireThat(body && body !== '-' && structure(body).some(line => /[\p{L}\p{N}]/u.test(line) && !/^\s*<!--/u.test(line)), 'INVALID_TASK_FIELDS');
    sections[field] = body;
  }
  return { title: selected.title, text: normalized(raw.slice(selected.index, end).join('\n')), sections };
}

function cells(line) {
  const value = line.trim();
  requireThat(value.startsWith('|') && value.endsWith('|'), 'INVALID_REGISTER');
  return value.slice(1, -1).split('|').map(cell => cell.trim());
}

function table(text, expected, code) {
  const lines = structure(text);
  const matches = lines.flatMap((line, index) => line.trim().startsWith('|') &&
    line.trim().endsWith('|') && line.trim().slice(1, -1).split('|').map(cell => cell.trim()).join('\0') === expected.join('\0') ? [index] : []);
  requireThat(matches.length === 1, code);
  const start = matches[0], separator = cells(lines[start + 1] ?? '');
  requireThat(separator.length === expected.length && separator.every(cell => /^:?-{3,}:?$/u.test(cell)), code);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    const row = cells(lines[i]);
    requireThat(row.length === expected.length && row[0] && !rows.some(old => old[0] === row[0]), code);
    rows.push(row);
  }
  return rows;
}

function validTimestamp(text) {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|([+-])(\d\d):(\d\d))$/u.exec(text);
  if (!match || +match[1] < 1 || +match[4] > 23 || +match[5] > 59 || +match[6] > 59 ||
      +(match[8] ?? 0) > 23 || +(match[9] ?? 0) > 59 || !Number.isFinite(Date.parse(text))) return false;
  const day = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return day.toISOString().slice(0, 10) === text.slice(0, 10);
}

function registerRows(text) {
  return table(text, header, 'INVALID_REGISTER').map(row => {
    requireThat(idPattern.test(row[0]) && row[1] === row[0].split('-')[0] && states.includes(row[2]) &&
      (row[3] === '-' || sha1.test(row[3])) &&
      validTimestamp(row[4]), 'INVALID_REGISTER');
    // Observations are parsed only for a dependency's explicit integration link, never returned.
    return { id: row[0], milestone: row[1], status: row[2], commit: row[3], updatedAt: row[4], observations: row[5] };
  });
}

function dependencies(text, taskId) {
  const rows = table(text, ['Task', 'Dependências obrigatórias', 'Justificativa'], 'INVALID_DEPENDENCIES');
  const selected = rows.find(row => row[0] === taskId);
  requireThat(selected, 'INVALID_DEPENDENCIES');
  if (selected[1] === '—') return [];
  const ids = selected[1].split(',').map(id => id.trim());
  requireThat(ids.length && ids.every(id => idPattern.test(id) && id !== taskId) && new Set(ids).size === ids.length, 'INVALID_DEPENDENCIES');
  return ids;
}

function git(workspace, args, encoding = 'utf8') {
  return execFileSync('git', ['--no-optional-locks', '-C', workspace, ...args], {
    shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 2 * 1024 * 1024,
    encoding, env: engineeringEnvironment(), stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Trusted preparation only: capture reviewed refs/HEAD, never approval from model input. */
export function taskGitRefsHash(workspace) {
  return digest(JSON.stringify({
    head: git(workspace, ['symbolic-ref', '--no-recurse', 'HEAD']).trimEnd(),
    object: git(workspace, ['rev-parse', '--verify', 'HEAD']).trimEnd(),
    refs: git(workspace, ['for-each-ref', '--sort=refname', '--format=%(refname)%00%(objectname)%00%(symref)']),
  }));
}

function trackedSnapshot(workspace) {
  for (const name of ['index.lock', 'HEAD.lock', 'config.lock', 'packed-refs.lock', 'MERGE_HEAD',
    'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG']) {
    requireThat(!existsSync(join(workspace, '.git', name)), 'GIT_OPERATION_IN_PROGRESS');
  }
  const refsHash = taskGitRefsHash(workspace);
  const index = git(workspace, ['ls-files', '--stage', '-z']);
  const seen = new Set();
  const files = index.split('\0').filter(Boolean).map(record => {
    const match = /^(100644|100755) ([a-f0-9]{40}) 0\t(.+)$/u.exec(record);
    requireThat(match && safePath(match[3]) && !seen.has(match[3]), 'UNSAFE_PATH');
    const path = match[3]; seen.add(path);
    const full = join(workspace, path), info = lstatSync(full);
    requireThat(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'UNSAFE_PATH');
    const bytes = readFileSync(full);
    // Raw-byte equality also catches a stale stat cache; fixtures use no checkout filters/EOL conversion.
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    requireThat(blob === match[2], 'DIRTY_CONTENT');
    return { path, sha256: digest(bytes) };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return { refsHash, indexHash: digest(index), configHash: digest(readFileSync(join(workspace, '.git', 'config'))), files };
}

function readTracked(workspace, snapshot, path) {
  requireThat(safePath(path), 'UNSAFE_PATH');
  requireThat(snapshot.files.some(file => file.path === path), 'MISSING_ARTIFACT');
  const bytes = readFileSync(join(workspace, path));
  requireThat(bytes.length <= 256 * 1024, 'ARTIFACT_TOO_LARGE');
  requireThat(digest(bytes) === snapshot.files.find(file => file.path === path).sha256, 'CONCURRENT_CHANGE');
  return bytes.toString('utf8');
}

function validateApproval(request, approval) {
  requireThat(exact(request, ['schemaVersion', 'taskId', 'workspace', 'baseline', 'branch']), 'INVALID_REQUEST');
  requireThat(exact(approval, ['schemaVersion', 'taskId', 'workspace', 'baseline', 'branch', 'taskHash', 'refsHash', 'allowedChanges']), 'APPROVAL_REQUIRED');
  requireThat(approval.schemaVersion === 1 && idPattern.test(approval.taskId) &&
    typeof approval.workspace === 'string' && isAbsolute(approval.workspace) && sha1.test(approval.baseline) &&
    typeof approval.branch === 'string' && /^[A-Za-z0-9][A-Za-z0-9_/-]{0,63}$/u.test(approval.branch) &&
    sha256.test(approval.taskHash) && sha256.test(approval.refsHash) && Array.isArray(approval.allowedChanges) && approval.allowedChanges.length > 0 &&
    approval.allowedChanges.length <= 64 && new Set(approval.allowedChanges.map(path => typeof path === 'string' ? path.toLowerCase() : path)).size === approval.allowedChanges.length &&
    approval.allowedChanges.every(path => safePath(path, true) && path.split('/').every(part =>
      !privateNames.has(part.toLowerCase()) && !/^\.env(?:\.|$)|\.(?:pem|key|pfx|p12)$/iu.test(part))), 'INVALID_APPROVAL');
  requireThat(Object.keys(request).every(key => request[key] === approval[key]), 'REQUEST_MISMATCH');
}

/**
 * approval is provided out-of-band by a trusted controller after human review, NOT by Pi.
 * No writes, Pi, locks, commands from the caller, transitions or commits. All errors are sanitized.
 */
export function validateTaskInput(request, approval) {
  try {
    validateApproval(request, approval);
    const engineering = { baseline: approval.baseline, branch: approval.branch, testPolicy: engineeringTestPolicy };
    let workspace;
    try { workspace = validateEngineeringWorkspace(request.workspace, engineering); }
    catch { fail('WORKSPACE_REJECTED'); }
    requireThat(workspace === realpathSync(approval.workspace), 'REQUEST_MISMATCH');
    const snapshot = trackedSnapshot(workspace);
    requireThat(snapshot.refsHash === approval.refsHash, 'GIT_REFS_MISMATCH');
    const maps = ['AGENTS.md', 'CLAUDE.md'].filter(path => existsSync(join(workspace, path)));
    requireThat(maps.length, 'MISSING_ARTIFACT');
    const paths = mapPaths(readTracked(workspace, snapshot, maps[0]));
    for (const map of maps.slice(1)) requireThat(JSON.stringify(mapPaths(readTracked(workspace, snapshot, map))) === JSON.stringify(paths), 'AMBIGUOUS_MAP');
    const plan = readTracked(workspace, snapshot, paths.plan);
    const register = readTracked(workspace, snapshot, paths.register);
    const task = selectTask(plan, request.taskId), taskHash = taskTextHash(task.text);
    requireThat(taskHash === approval.taskHash, 'TASK_APPROVAL_MISMATCH');
    const rows = registerRows(register), row = rows.find(item => item.id === request.taskId);
    requireThat(row, 'TASK_NOT_REGISTERED');
    // A resume requires proof of the old execution/lease, outside the scope of initial admission.
    requireThat(row.status === 'não iniciada' && row.commit === '-', 'INITIAL_STATE_REJECTED');
    const dependencyIds = dependencies(plan, request.taskId);
    const dependencyMetadata = dependencyIds.map(id => {
      const dep = rows.find(item => item.id === id);
      requireThat(dep?.status === 'concluída' && sha1.test(dep.commit), 'DEPENDENCY_PENDING');
      const links = dep.observations.split(';').map(part => part.trim()).filter(part => part.includes('Integração:'));
      requireThat(links.length <= 1 && (!links.length || /^Integração: [a-f0-9]{40}$/u.test(links[0])), 'DEPENDENCY_EVIDENCE_MISSING');
      const commit = links.length ? links[0].slice('Integração: '.length) : dep.commit;
      try { git(workspace, ['merge-base', '--is-ancestor', commit, approval.baseline]); }
      catch { fail('DEPENDENCY_EVIDENCE_MISSING'); }
      if (links.length) {
        // A rewritten history must contain both the delivery and the concluded row in the integrated commit.
        try {
          const integrated = registerRows(git(workspace, ['show', `${commit}:${paths.register}`])).find(item => item.id === id);
          requireThat(integrated?.status === 'concluída' && integrated.commit === dep.commit, 'DEPENDENCY_EVIDENCE_MISSING');
        } catch { fail('DEPENDENCY_EVIDENCE_MISSING'); }
        return { id, commit, evidence: 'integration' };
      }
      // Find a versioned conclusion after the functional commit, without exposing historical narratives.
      const history = git(workspace, ['log', '-64', '--format=%H', approval.baseline, '--', paths.register]).trim().split('\n');
      for (const metadata of history) {
        if (!sha1.test(metadata) || metadata === commit) continue;
        try {
          git(workspace, ['merge-base', '--is-ancestor', commit, metadata]);
          const historical = registerRows(git(workspace, ['show', `${metadata}:${paths.register}`])).find(item => item.id === id);
          if (historical?.status === 'concluída' && historical.commit === dep.commit) return { id, commit, metadata, evidence: 'two-commits' };
        } catch { /* Not evidence; try the next bounded historical version. */ }
      }
      fail('DEPENDENCY_EVIDENCE_MISSING');
    });
    const protectedPaths = ['AGENTS.md', 'CLAUDE.md', paths.plan, paths.register, '.devout-disposable.json'];
    for (const path of approval.allowedChanges) {
      requireThat(!protectedPaths.some(protectedPath => path.toLowerCase() === protectedPath.toLowerCase() ||
        (path.endsWith('/') && protectedPath.toLowerCase().startsWith(path.toLowerCase()))), 'CHANGE_AREA_REJECTED');
      const parts = path.replace(/\/$/u, '').split('/');
      for (let i = 1; i < parts.length; i++) {
        const parent = join(workspace, ...parts.slice(0, i));
        requireThat(!existsSync(parent) || lstatSync(parent).isDirectory(), 'CHANGE_AREA_REJECTED');
      }
      const target = join(workspace, path);
      requireThat(!existsSync(target) || lstatSync(target).isDirectory() === path.endsWith('/'), 'CHANGE_AREA_REJECTED');
    }
    // Re-read the complete worktree/index and admission policy before returning the input.
    try {
      const after = trackedSnapshot(workspace);
      requireThat(JSON.stringify(snapshot) === JSON.stringify(after), 'CONCURRENT_CHANGE');
      validateEngineeringWorkspace(workspace, engineering);
      requireThat(taskGitRefsHash(workspace) === snapshot.refsHash, 'CONCURRENT_CHANGE');
    } catch { fail('CONCURRENT_CHANGE'); }
    const snapshotId = digest(JSON.stringify({ workspace, baseline: approval.baseline, branch: approval.branch, ...snapshot }));
    const publicInput = { taskId: row.id, taskHash, baseline: approval.baseline, branch: approval.branch,
      snapshotId, task: { title: task.title, text: task.text, sections: task.sections },
      dependencies: dependencyIds, allowedChanges: [...approval.allowedChanges].sort(), testPolicy: engineeringTestPolicy };
    const inputId = digest(JSON.stringify(publicInput));
    return { schemaVersion: 1, accepted: true, reason: null, gate: 'implementation-entry', taskApproved: false,
      input: { inputId, ...publicInput }, snapshot,
      official: { taskId: row.id, milestone: row.milestone, status: row.status, updatedAt: row.updatedAt },
      dependencies: dependencyMetadata };
  } catch (error) {
    return { schemaVersion: 1, accepted: false, reason: { code: error.refusal ?? 'INSPECTION_FAILED' },
      gate: 'implementation-entry', taskApproved: false, input: null };
  }
}

/** Re-run immediately before handoff; an inputId is evidence, never a launch capability. */
export function revalidateTaskInput(request, approval, inputId) {
  if (typeof inputId !== 'string' || !sha256.test(inputId)) return {
    schemaVersion: 1, accepted: false, reason: { code: 'INVALID_INPUT_ID' },
    gate: 'implementation-entry', taskApproved: false, input: null,
  };
  const result = validateTaskInput(request, approval);
  if (!result.accepted || result.input.inputId === inputId) return result;
  return { schemaVersion: 1, accepted: false, reason: { code: 'SNAPSHOT_MISMATCH' },
    gate: 'implementation-entry', taskApproved: false, input: null };
}
