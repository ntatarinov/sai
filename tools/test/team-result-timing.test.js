// REQ-102, criterion 7 (Q10): the check of secrets, findSecrets from
// tools/src/pixel-office/mask.js, works in linear time on hostile input and looks at
// the whole input. This is the instrument of the criterion: twelve families of input
// without a secret, each its own test (so a run of a slow mutant can pick one family by
// name), three sizes each, the two outcomes checked at every size, the time of k calls in
// one process, a warm-up, the median of seven repeats, both ratios below 8; and the
// control of the instrument, a quadratic function that must be seen (two-step ratio
// from 64) and a one-pass function that must not (below 8).
//
// The file is separate from team-result-bytes.test.js so that the timing runs in a
// process of its own, next to no other test of the file (the requirement names one
// file; the split is reported). Nothing here is a real secret: the bait that must be
// found at the end of every input is built from parts. No port is bound, no file is
// written, the clock is read only to measure (process.hrtime.bigint).
import assert from "node:assert/strict";
import { test } from "node:test";
import { findSecrets } from "../src/pixel-office/mask.js";

const KIB = 1024;
const MIB = 1024 * KIB;
const FLOOR_MS = 20;
const RATIO_MAX = 8;
const REPEATS = 7;
const K_MAX = 1 << 16;
const GHP = "gh" + "p_";
const BEGIN = "-----" + "BEGIN";
const AKIA = "AK" + "IA";
const EYJ = "ey" + "J";
const ALNUM = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const UPPER = "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8";

function fill(n, alphabet) {
  let out = "";
  for (let i = 0; i < n; i += 1) out += alphabet[i % alphabet.length];
  return out;
}

// The bait that must be found at the end of every input (a key with a known prefix).
const BAIT = `${GHP}${fill(36, ALNUM)}`;

// ---- the instrument -----------------------------------------------------------------------

function timeCalls(fn, input, k) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < k; i += 1) fn(input);
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1];
}

// Measures fn on the inputs from the smallest to the largest. One warm-up call on the
// smallest input; k is doubled on it until the sum of k calls is not shorter than
// FLOOR_MS (the floor checks the instrument, not the code), the same k is taken on the
// other sizes; one warm-up call per size; `repeats` measurements, the median. `ratioMax`
// (when given) is checked after each size and stops the run at the first failure:
// a size is also given up as soon as more than half of its repeats are already over the
// limit (then the median is over it too), so a quadratic function does not hang the run.
// `fixedK` replaces the choice of k (the control). Returns { k, times }.
function measure(
  fn,
  makeInputs,
  { repeats = REPEATS, ratioMax, fixedK, check } = {},
) {
  let k = fixedK ?? 1;
  const times = [];
  makeInputs.forEach((make, index) => {
    const input = make();
    if (check !== undefined) check(input, index);
    // one warm-up per size; the control (fixedK) warms up on the smallest size only
    if (index === 0 || fixedK === undefined) fn(input);
    if (index === 0 && fixedK === undefined) {
      while (timeCalls(fn, input, k) < FLOOR_MS) {
        k *= 2;
        assert.ok(k <= K_MAX, "the floor of the instrument is not reached");
      }
    }
    const samples = [];
    let over = 0;
    for (let r = 0; r < repeats; r += 1) {
      const sample = timeCalls(fn, input, k);
      samples.push(sample);
      if (
        ratioMax !== undefined &&
        index > 0 &&
        sample / times[index - 1] >= ratioMax
      ) {
        over += 1;
        assert.ok(
          over * 2 <= repeats,
          `size ${index}: the time grows by a factor of ${(sample / times[index - 1]).toFixed(2)} or more (limit ${ratioMax}), ${over} of ${r + 1} repeats`,
        );
      }
    }
    times.push(median(samples));
    if (ratioMax !== undefined && index > 0) {
      const ratio = times[index] / times[index - 1];
      assert.ok(
        ratio < ratioMax,
        `size ${index}: the ratio ${ratio.toFixed(2)} is not below ${ratioMax} (${times[index - 1].toFixed(1)} ms, ${times[index].toFixed(1)} ms, k ${k})`,
      );
    }
  });
  return { k, times };
}

// The two outcomes at one size: "no secret" on the input, "found" with the bait at its end.
function outcomes(input, label) {
  assert.equal(
    findSecrets(input),
    null,
    `${label}: the input must hold no secret`,
  );
  assert.notEqual(
    findSecrets(`${input}\n${BAIT}`),
    null,
    `${label}: the bait at the end must be found (the check looks at the whole input)`,
  );
}

const repeatTo = (unit, size) => unit.repeat(Math.floor(size / unit.length));

// ---- the twelve families -------------------------------------------------------------------

const SIZES = [256 * KIB, MIB, 4 * MIB];
const SMALL_SIZES = [16 * KIB, 64 * KIB, 256 * KIB];
const closers = (size) => {
  const q = Math.floor((size - 6) / 6);
  return `token=${")".repeat(q)}${"]".repeat(q)}${"}".repeat(q)}${")]}".repeat(q)}`;
};

const FAMILIES = [
  [
    1,
    "a certificate header with no END line (dense starts of the PEM rule)",
    `${BEGIN} CERTIFICATE-----\n`,
    SIZES,
  ],
  [
    2,
    "sk- and 15 characters (a prefix key that is too short)",
    `sk-${fill(15, ALNUM)} `,
    SIZES,
  ],
  [3, "x. repeated without spaces (one long dotted chain)", "x.", SIZES],
  [
    4,
    "a JWT of two parts (not a JWT)",
    `${EYJ}hbGciOiJIUzI1NiJ9.${EYJ}zdWIiOiJmYWtlIn0 `,
    SIZES,
  ],
  [
    5,
    "a://u: repeated, no @ (dense starts of the address rule)",
    "a://u:",
    SIZES,
  ],
  [
    6,
    "password= and a line end (empty values, dense starts of name=value)",
    "password=\n",
    SIZES,
  ],
  [
    7,
    "AKIA and 15 characters (a key that is too short)",
    `${AKIA}${fill(15, UPPER)} `,
    SIZES,
  ],
  [
    8,
    "Authorization: Bearer with a template (dense starts of Authorization and Bearer)",
    "Authorization: Bearer ${t}\n",
    SIZES,
  ],
  [9, "a placeholder in quotes", 'password="changeme" ', SIZES],
  [
    11,
    "unclosed groups after a name and after Bearer, on one line",
    "token={{ password=$( Bearer {{ Bearer $( ",
    SMALL_SIZES,
  ],
];

for (const [n, what, unit, sizes] of FAMILIES) {
  test(
    `RB-15 criterion 7, family ${n}: ${what} - the result is "no secret" and "found" with the bait at the end at every size; the time grows by a factor below 8 for four times the input`,
    { timeout: 600_000 },
    () => {
      const makers = sizes.map((size) => () => repeatTo(unit, size));
      measure(findSecrets, makers, {
        ratioMax: RATIO_MAX,
        check: (input, i) => outcomes(input, `family ${n}, size ${sizes[i]}`),
      });
    },
  );
}

test(
  'RB-15 criterion 7, family 10: token= and one value that is a long path "a.a.a....b" - no secret, no exception (no regular expression with a repeated group), the bait at the end is found, the time grows by a factor below 8',
  { timeout: 600_000 },
  () => {
    const makers = SIZES.map(
      (size) => () => `token=${"a.".repeat(Math.floor((size - 7) / 2))}b`,
    );
    measure(findSecrets, makers, {
      ratioMax: RATIO_MAX,
      check: (input, i) => outcomes(input, `family 10, size ${SIZES[i]}`),
    });
  },
);

test(
  "RB-15 criterion 7, family 12: token= and long runs of closing brackets ) ] } and )]} with no opener - dropped in one pass, no exception, the bait at the end is found, the time grows by a factor below 8",
  { timeout: 900_000 },
  () => {
    const makers = SIZES.map((size) => () => closers(size));
    measure(findSecrets, makers, {
      ratioMax: RATIO_MAX,
      check: (input, i) => outcomes(input, `family 12, size ${SIZES[i]}`),
    });
  },
);

// ---- the control of the instrument ------------------------------------------------------------------

let sink = 0;

// For every character reads the rest of the input to its end; independent of the content.
function quadratic(text) {
  let acc = 0;
  for (let i = 0; i < text.length; i += 1) {
    for (let j = i; j < text.length; j += 1) acc += text.charCodeAt(j) & 1;
  }
  sink ^= acc;
  return acc;
}

// One pass.
function onePass(text) {
  let acc = 0;
  for (let i = 0; i < text.length; i += 1) acc += text.charCodeAt(i) & 1;
  sink ^= acc;
  return acc;
}

const CONTROL_UNIT = `${BEGIN} CERTIFICATE-----\n`;

test(
  "RB-15 criterion 7, control: a function with a quadratic time that the test itself holds is seen - one call on 8 KiB is not shorter than 20 ms, and the time on 128 KiB is at least 64 times the time on 8 KiB (k 1, one warm-up, three repeats)",
  { timeout: 600_000 },
  () => {
    const sizes = [8 * KIB, 32 * KIB, 128 * KIB];
    const { times } = measure(
      quadratic,
      sizes.map((size) => () => repeatTo(CONTROL_UNIT, size)),
      {
        repeats: 3,
        fixedK: 1,
      },
    );
    assert.ok(
      times[0] >= FLOOR_MS,
      `one call on 8 KiB takes ${times[0].toFixed(1)} ms: the sizes of the control are too small`,
    );
    const ratio = times[2] / times[0];
    assert.ok(
      ratio >= 64,
      `the two-step ratio ${ratio.toFixed(1)} is below 64: the instrument does not see a quadratic time`,
    );
    assert.equal(typeof sink, "number");
  },
);

test(
  "RB-15 criterion 7, control: a function with one pass over the input is not mistaken for a slow one - both ratios on 256 KiB, 1 MiB and 4 MiB are below 8",
  { timeout: 600_000 },
  () => {
    measure(
      onePass,
      SIZES.map((size) => () => repeatTo(CONTROL_UNIT, size)),
      { ratioMax: RATIO_MAX },
    );
  },
);
