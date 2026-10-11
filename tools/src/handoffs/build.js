// The names, the identifier and the text of a new handoff (design REQ-039, 4.3-4.4).
// Pure functions: the time and the tag are given by the caller.

// { rel, handoffId, round } of the checked values.
export function handoffNames({ run, step, role, qualifier, suffix }) {
  const tail =
    (qualifier === undefined ? "" : `-${qualifier}`) +
    (suffix === undefined ? "" : `-${suffix}`);
  const rel = `handoffs/${run}/step-${step}-${role.toLowerCase()}${tail}.json`;
  const handoffId = `step${step}${tail}-${run}`;
  const m = suffix === undefined ? null : /^r([0-9]+)$/u.exec(suffix);
  return { rel, handoffId, round: m === null ? undefined : Number(m[1]) };
}

// The document in the fixed order of keys. `baseTag` is "base/<RUN-ID>" or null.
export function buildDocument(opts, names, stamp, baseTag) {
  const context = {
    requirement_ids: opts.requirement,
    agent_run_id: null,
    artifacts_in: opts.artifactIn,
  };
  if (opts.route !== undefined) context.route = opts.route;
  if (opts.writeSet.length > 0) context.write_set = opts.writeSet;
  if (baseTag !== null) context.base_tag = baseTag;
  if (opts.reworkOf !== undefined) context.rework_of = opts.reworkOf;
  const doc = {
    handoff_id: names.handoffId,
    run_id: opts.run,
    workflow_id: opts.workflow,
    step: opts.step,
  };
  if (names.round !== undefined) doc.round = names.round;
  Object.assign(doc, {
    from_agent: "ORCH",
    to_agent: opts.role,
    file: names.rel,
    status: "PENDING",
    priority: opts.priority ?? "NORMAL",
    context,
    task: {
      description: opts.task,
      acceptance_criteria: opts.criterion,
    },
    created_at: stamp,
    started_at: stamp,
    completed_at: null,
    result: null,
  });
  return doc;
}

// Two spaces, a line feed at the end, no escaping of letters.
export function serialize(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
