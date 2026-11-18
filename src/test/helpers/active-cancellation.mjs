// Shared by the opt-in real smoke and deterministic regressions. No raw payloads.
export function activeCancellationEvidence({ events, control, result }) {
  const fail = code => { throw Object.assign(new Error(code), { code }); };
  const one = predicate => {
    const matches = events.filter(predicate);
    if (matches.length !== 1) fail('ACTIVE_CANCEL_EVIDENCE_MISSING');
    return matches[0];
  };
  const started = one(event => event.type === 'response_started');
  const consumed = one(event => event.type === 'cancel_observed');
  const settled = one(event => event.type === 'pi_event' && event.event === 'agent_settled');
  // Driver.cancel() can reject promptAndWait before the abort settlement arrives,
  // so prompt_observed is optional; the final observed flags still record it.
  const prompts = events.filter(event => event.type === 'prompt_observed');
  if (prompts.length > 1) fail('ACTIVE_CANCEL_EVIDENCE_INVALID');
  const prompt = prompts[0];
  const requestedAt = Date.parse(control.requestedAt);
  const times = [started.at, consumed.at, settled.at].map(Date.parse);
  if (control.runId !== result.runId || events.some(event => event.runId !== result.runId) ||
      !Number.isFinite(requestedAt) || times.some(time => !Number.isFinite(time))) fail('ACTIVE_CANCEL_EVIDENCE_INVALID');
  // A received delta or an accepted abort alone does not prove active interruption.
  // Both the durable request and its consumption must precede settlement. Equal
  // wall-clock milliseconds are deliberately inconclusive, never a false pass.
  if (!(started.seq < consumed.seq && consumed.seq < settled.seq &&
        times[0] <= requestedAt && requestedAt <= times[1] && times[1] < times[2]) ||
      prompt && !(settled.seq < prompt.seq && times[2] <= Date.parse(prompt.at))) {
    fail('ACTIVE_CANCEL_ORDER_INVALID');
  }
  if (events.some(event => event.seq < consumed.seq &&
      (event.type === 'failure' || event.type === 'driver_failure' || event.type === 'state' && event.state === 'stopping'))) {
    fail('ACTIVE_CANCEL_ALREADY_STOPPING');
  }
  if (!(result.cancellation?.requested && result.technicalOutcome === 'interrupted' &&
        result.observed?.promptAccepted && result.observed.responseStarted && result.observed.settled &&
        (result.observed.aborted || result.observed.assistantError) &&
        (!prompt || prompt.accepted && prompt.settled && (prompt.aborted || prompt.assistantError)) &&
        result.termination?.abortAccepted && !result.termination.forced && !result.termination.workCompleted)) {
    fail('ACTIVE_CANCEL_INTERRUPTION_UNPROVEN');
  }
  return { responseStartedAt: started.at, requestedAt: control.requestedAt, consumedAt: consumed.at,
    settledAt: settled.at, responseStartedSeq: started.seq, consumedSeq: consumed.seq, settledSeq: settled.seq,
    interruptionObserved: true };
}
