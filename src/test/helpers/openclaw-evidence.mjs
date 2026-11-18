// Deterministic evidence gate for the opt-in T06 procedure, not task approval.
import { activeCancellationEvidence } from './active-cancellation.mjs';
import { join } from 'node:path';
const fail = () => { throw Object.assign(new Error('OPENCLAW_EVIDENCE_INVALID'), { code: 'OPENCLAW_EVIDENCE_INVALID' }); };
const require = value => { if (!value) fail(); };
export function checkRunEvidence({ result: r, state, events, control }, kind) {
  require(['normal', 'cancel', 'duplicate', 'mismatch'].includes(kind));
  require(r?.schemaVersion === 1 && /^run-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(r.runId) && r.role === 'test');
  require(r.taskApproved === false && r.state === 'terminated' && Number.isSafeInteger(r.runnerPid) && r.runnerPid > 0);
  require(typeof r.taskId === 'string' && typeof r.cancellation?.requested === 'boolean');
  require(['acquired', 'released'].every(key => typeof r.lock?.[key] === 'boolean'));
  require(['stateCorrelated', 'modelAvailable', 'promptAccepted', 'settled', 'aborted', 'assistantError', 'markerMatched', 'responseStarted']
    .every(key => typeof r.observed?.[key] === 'boolean'));
  require(state?.schemaVersion === 1 && state.role === 'test' && state.runId === r.runId && state.runnerPid === r.runnerPid && state.taskId === r.taskId && state.state === r.state);
  require(Number.isFinite(Date.parse(r.startedAt)) && Date.parse(r.startedAt) <= Date.parse(r.finishedAt));
  require(control?.schemaVersion === 1 && control.runId === r.runId && control.runnerPid === r.runnerPid && control.status === 'closed' && control.finalState === 'terminated');
  require(Array.isArray(events) && events.length > 0 && events.every((e, i) => e.runId === r.runId && e.seq === i + 1 &&
    Date.parse(e.at) >= Date.parse(r.startedAt) && Date.parse(e.at) <= Date.parse(r.finishedAt) &&
    (i === 0 || Date.parse(e.at) >= Date.parse(events[i - 1].at))));
  const has = (type, value) => events.some(e => e.type === type && (value === undefined || e.state === value));
  require(events[0].type === 'state' && events[0].state === 'starting' && has('state', 'stopping') && events.at(-1).state === 'terminated');
  require(has('control_closed') && Array.isArray(r.errorCodes));
  if (kind === 'duplicate') {
    require(r.technicalOutcome === 'failed' && r.lock?.acquired === false && r.lock.released === false && r.termination === null);
    require(r.errorCodes.some(code => ['LOCK_BUSY', 'LOCK_RECONCILIATION_REQUIRED'].includes(code)));
    require(!has('lock_acquired') && !has('pi_event') && !has('state', 'running') && !r.observed?.promptAccepted);
  } else {
    require(r.lock?.acquired && r.lock.released && has('lock_acquired') && has('state', 'running') && has('state_observed'));
    require(r.termination?.state === 'terminated' && r.termination.processesGone === true && r.termination.canRelease === true);
    require(['workCompleted', 'forced', 'abortAccepted'].every(key => typeof r.termination[key] === 'boolean'));
    require(Number.isSafeInteger(r.termination.identity?.pid) && r.termination.identity.pid > 0 && typeof r.termination.identity.created === 'string');
    require(Array.isArray(r.termination.observed) && r.termination.observed.some(p =>
      p.pid === r.termination.identity.pid && p.created === r.termination.identity.created));
    require(r.observed?.stateCorrelated && r.observed.modelAvailable && r.observed.promptAccepted && r.observed.settled);
    require(events.some(e => e.type === 'pi_event' && e.event === 'agent_settled'));
    if (kind === 'cancel') {
      require(r.errorCodes.includes('CANCELLED'));
      activeCancellationEvidence({ result: r, events, control });
    } else {
      require(!r.cancellation?.requested && control.requestedAt === null && !r.observed.aborted && !r.observed.assistantError);
      require(!r.termination.forced && r.termination.exitCode === 0);
      if (kind === 'normal') require(r.technicalOutcome === 'succeeded' && r.observed.markerMatched && r.termination.workCompleted && r.errorCodes.length === 0);
      else require(r.technicalOutcome === 'failed' && !r.observed.markerMatched && r.errorCodes.includes('RESPONSE_MISMATCH'));
    }
  }
  return { runId: r.runId, taskId: r.taskId, runnerPid: r.runnerPid, state: r.state,
    technicalOutcome: r.technicalOutcome, taskApproved: false, lock: r.lock,
    startedAt: r.startedAt, finishedAt: r.finishedAt, eventCount: events.length,
    observed: r.observed, termination: r.termination, errorCodes: r.errorCodes,
    ...(kind === 'cancel' ? { piReadyAt: events.find(e => e.type === 'state_observed')?.at,
      activeCancellation: activeCancellationEvidence({ result: r, events, control }) } : {}) };
}

// Whitelist projection of OUR disposable transcript; never emit raw messages,
// tool output, paths, prompts, model metadata or credential-bearing config.
export function checkOpenClawTrace(transcript, { runner, root, cases }) {
  require(Array.isArray(transcript?.messages));
  const nested = transcript.messages.filter(m => m.customType === 'openclaw.nested-tool.v1').map(m => m.details);
  const runnerCalls = nested.filter(d => d?.toolName === 'exec' && d.input?.command?.includes(runner));
  require(runnerCalls.length === 5);
  const commands = Object.fromEntries(['cancel', 'duplicate', 'normal', 'mismatch'].map(kind =>
    [kind, `node "${runner}" run --config "${join(root, `${kind}.json`)}"`]));
  const summary = {};
  for (const [kind, command] of Object.entries(commands)) {
    const calls = runnerCalls.filter(d => d.input.command === command); require(calls.length === 1);
    const call = calls[0], input = call.input, result = call.result?.details;
    require(input.pty === false && input.yieldMs === 1000 && input.awaitResults === false && input.timeoutSeconds === 240);
    require(!input.background && !input.node && [undefined, 'auto', 'gateway'].includes(input.host));
    require(result?.status === 'running' && typeof result.sessionId === 'string' && result.sessionId.length > 0);
    const polls = nested.filter(d => d?.toolName === 'process' && d.input?.sessionId === result.sessionId && d.input.action === 'poll');
    const logs = nested.filter(d => d?.toolName === 'process' && d.input?.sessionId === result.sessionId && d.input.action === 'log');
    const exitCode = kind === 'normal' ? 0 : 1;
    const terminal = polls.find(d => ['completed', 'failed'].includes(d.result?.details?.status) && d.result.details.exitCode === exitCode);
    require(terminal && logs.length > 0);
    const record = (terminal.result.details.aggregated ?? '').split('\n').flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    }).find(e => e.type === 'result' && e.runId === cases[kind]?.runId);
    require(record?.state === 'terminated' && record.taskApproved === false && record.technicalOutcome === cases[kind]?.technicalOutcome);
    require(Number.isFinite(call.startedAt) && Number.isFinite(terminal.timestamp) && call.startedAt < terminal.timestamp);
    summary[kind] = { runId: record.runId, execSessionId: result.sessionId, yieldMs: input.yieldMs, pty: input.pty,
      awaitResults: input.awaitResults, timeoutSeconds: input.timeoutSeconds, initialStatus: result.status,
      terminalStatus: terminal.result.details.status, exitCode, pollCount: polls.length, logCount: logs.length,
      invokedAt: new Date(call.startedAt).toISOString(), collectedAt: new Date(terminal.timestamp).toISOString() };
  }
  require(new Set(Object.values(summary).map(c => c.execSessionId)).size === 4);
  const cancelCommand = `node "${runner}" cancel --artifacts-root "${join(root, 'operacional')}" --run-id "${cases.cancel.runId}"`;
  const requests = runnerCalls.filter(d => d.input.command === cancelCommand); require(requests.length === 1);
  const receipt = requests[0].result?.details; require(receipt?.exitCode === 0);
  const parsed = JSON.parse(receipt.aggregated); require(parsed.type === 'cancel_request' && parsed.runId === cases.cancel.runId && parsed.status === 'requested');
  require(Date.parse(summary.cancel.collectedAt) < Date.parse(summary.normal.invokedAt) &&
    Date.parse(summary.normal.collectedAt) < Date.parse(summary.mismatch.invokedAt));
  return { cases: summary, cancellationReceipt: { runId: parsed.runId, status: parsed.status },
    transcriptMessageCount: transcript.messages.length, controllerToolErrors: transcript.messages.filter(m => m.role === 'toolResult' && m.isError === true).length,
    taskApproved: false, pass: true };
}

export function checkScenarioOrder(cases) {
  const { cancel, duplicate, normal, mismatch } = cases;
  require(cancel && duplicate && normal && mismatch && new Set(Object.values(cases).map(c => c.runId)).size === 4);
  const t = Date.parse;
  require(t(cancel.piReadyAt) <= t(duplicate.startedAt) &&
    t(duplicate.finishedAt) < t(cancel.activeCancellation.requestedAt) &&
    t(cancel.finishedAt) < t(normal.startedAt) && t(normal.finishedAt) < t(mismatch.startedAt));
  return true;
}
