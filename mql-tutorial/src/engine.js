// A small, self-contained interpreter for a beginner-friendly subset of
// MongoDB Query Language (MQL): find() filters/projection/sort/limit, and
// aggregate() pipelines with $match/$group/$sort/$limit/$project.
//
// It exists so the tutorial can run entirely in the browser against the
// bundled sample datasets, without a real MongoDB server.

const COMPARISON_OPS = {
  $eq: (a, b) => a === b,
  $ne: (a, b) => a !== b,
  $gt: (a, b) => a > b,
  $gte: (a, b) => a >= b,
  $lt: (a, b) => a < b,
  $lte: (a, b) => a <= b,
  $in: (a, b) => Array.isArray(b) && b.includes(a),
  $nin: (a, b) => Array.isArray(b) && !b.includes(a),
  $exists: (a, b) => (b ? a !== undefined : a === undefined),
  $regex: (a, b, cond) => {
    if (typeof a !== "string") return false;
    const flags = cond.$options || "";
    return new RegExp(b, flags).test(a);
  },
};

function matchesCondition(value, condition) {
  const isOperatorObject =
    condition !== null &&
    typeof condition === "object" &&
    !Array.isArray(condition) &&
    Object.keys(condition).some((k) => k.startsWith("$"));

  if (!isOperatorObject) {
    return value === condition;
  }

  return Object.entries(condition).every(([op, operand]) => {
    if (op === "$options") return true; // handled alongside $regex
    if (op === "$not") return !matchesCondition(value, operand);
    const fn = COMPARISON_OPS[op];
    if (!fn) throw new Error(`Unsupported operator: ${op}`);
    return fn(value, operand, condition);
  });
}

export function matchDocument(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;

  return Object.entries(filter).every(([key, condition]) => {
    if (key === "$and") return condition.every((f) => matchDocument(doc, f));
    if (key === "$or") return condition.some((f) => matchDocument(doc, f));
    if (key === "$nor") return !condition.some((f) => matchDocument(doc, f));
    return matchesCondition(doc[key], condition);
  });
}

function applyProjection(doc, projection) {
  if (!projection || Object.keys(projection).length === 0) return doc;
  const entries = Object.entries(projection);
  const isExclusion = entries.every(([, v]) => v === 0 || v === false);

  if (isExclusion) {
    const out = { ...doc };
    entries.forEach(([field]) => delete out[field]);
    return out;
  }

  const out = {};
  entries.forEach(([field, include]) => {
    if (include) out[field] = doc[field];
  });
  return out;
}

function applySort(docs, sort) {
  if (!sort || Object.keys(sort).length === 0) return docs;
  const keys = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [field, dir] of keys) {
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return av < bv ? -dir : dir;
    }
    return 0;
  });
}

/**
 * find(data, filter, { projection, sort, limit })
 */
export function find(data, filter = {}, options = {}) {
  let results = data.filter((doc) => matchDocument(doc, filter));
  if (options.sort) results = applySort(results, options.sort);
  if (options.limit) results = results.slice(0, options.limit);
  if (options.projection) {
    results = results.map((doc) => applyProjection(doc, options.projection));
  }
  return results;
}

function resolveFieldPath(doc, path) {
  // Supports simple "$fieldName" accumulator/group-key references.
  if (typeof path !== "string" || !path.startsWith("$")) return path;
  return doc[path.slice(1)];
}

function runGroupStage(docs, stage) {
  const { _id: idSpec, ...accumulators } = stage;
  const groups = new Map();

  for (const doc of docs) {
    const key =
      idSpec === null
        ? null
        : typeof idSpec === "object"
        ? Object.fromEntries(
            Object.entries(idSpec).map(([k, v]) => [k, resolveFieldPath(doc, v)])
          )
        : resolveFieldPath(doc, idSpec);

    const keyString = JSON.stringify(key);
    if (!groups.has(keyString)) {
      groups.set(keyString, { _id: key, docs: [] });
    }
    groups.get(keyString).docs.push(doc);
  }

  const output = [];
  for (const { _id, docs: groupDocs } of groups.values()) {
    const row = { _id };
    for (const [outField, accSpec] of Object.entries(accumulators)) {
      const [accOp, operand] = Object.entries(accSpec)[0];
      const values = (() => {
        if (accOp === "$sum" && operand === 1) return groupDocs.map(() => 1);
        return groupDocs.map((d) => resolveFieldPath(d, operand));
      })();

      switch (accOp) {
        case "$sum":
          row[outField] = values.reduce((a, b) => a + (Number(b) || 0), 0);
          break;
        case "$avg":
          row[outField] =
            values.reduce((a, b) => a + (Number(b) || 0), 0) / values.length;
          break;
        case "$min":
          row[outField] = Math.min(...values.map(Number));
          break;
        case "$max":
          row[outField] = Math.max(...values.map(Number));
          break;
        case "$push":
          row[outField] = values;
          break;
        default:
          throw new Error(`Unsupported accumulator: ${accOp}`);
      }
    }
    output.push(row);
  }
  return output;
}

/**
 * aggregate(data, pipeline) — supports $match, $group, $sort, $limit, $project
 */
export function aggregate(data, pipeline = []) {
  let docs = [...data];

  for (const stage of pipeline) {
    const [stageName, spec] = Object.entries(stage)[0];
    switch (stageName) {
      case "$match":
        docs = docs.filter((doc) => matchDocument(doc, spec));
        break;
      case "$group":
        docs = runGroupStage(docs, spec);
        break;
      case "$sort":
        docs = applySort(docs, spec);
        break;
      case "$limit":
        docs = docs.slice(0, spec);
        break;
      case "$project":
        docs = docs.map((doc) => applyProjection(doc, spec));
        break;
      default:
        throw new Error(`Unsupported pipeline stage: ${stageName}`);
    }
  }
  return docs;
}

// --- Comparison helper used for grading student answers -------------------

function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectKeys(value[key]);
        return acc;
      }, {});
  }
  if (typeof value === "number") return Math.round(value * 100) / 100;
  return value;
}

/**
 * Two result sets are considered equal if they contain the same documents,
 * regardless of order or key ordering — so multiple correct query phrasings
 * (e.g. different but equivalent filters) all pass.
 */
export function resultsAreEquivalent(a, b) {
  const normalize = (arr) =>
    arr.map((doc) => JSON.stringify(sortObjectKeys(doc))).sort();
  const na = normalize(a);
  const nb = normalize(b);
  return na.length === nb.length && na.every((v, i) => v === nb[i]);
}

/**
 * Order-sensitive variant, for lessons where the task explicitly asks for a
 * sorted result — an otherwise-correct filter with the wrong (or missing)
 * sort should not pass.
 */
export function resultsMatchInOrder(a, b) {
  if (a.length !== b.length) return false;
  const normalize = (doc) => JSON.stringify(sortObjectKeys(doc));
  return a.every((doc, i) => normalize(doc) === normalize(b[i]));
}
