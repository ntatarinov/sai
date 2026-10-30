// REQ-102 (defect ISS-0093, decisions/0102 and 0105): a result file is stored and
// read byte for byte; a file with a real secret is refused (reason "secret"), the
// journal and Pixel Office keep masking as before. Criteria 1-6, 8(b), 9, 11 and 12
// of the requirement are tested here, criterion 7 (linear time) in
// team-result-timing.test.js (its own file, so that the timing runs alone in a
// process).
//
// The expected values are the samples of the requirement, written in this file as
// data (groups O: stored; groups C: refused), with literal sha256 values taken with
// `shasum -a 256` from the bytes of the samples, never from the code under test.
// Nothing here is a real secret: every bait is built from parts at run time and no
// key-shaped word stands in this file in one piece (RB-10 searches for them). Each
// test makes its own temporary folders (the helpers), starts only the fake
// executables of fixtures/team, binds no port and does not depend on the order or
// the clock. Failure tests check that the state did not change (Q5).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { findSecrets, maskSecrets } from "../src/pixel-office/mask.js";
import { TeamError } from "../src/team/errors.js";
import { secretDetail } from "../src/team/language.js";
import { depsOf, runTask } from "../src/team/runner.js";
import { readConfig } from "../src/team/config.js";
import { createProject, openWriter, readProject } from "../src/team/store.js";
import {
  FIXTURES,
  allFilesText,
  assertSafeEnv,
  execEnv,
  fakeStarts,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  runTeam,
  stateOf,
  withLimit,
  writePlan,
} from "./exec-helpers.js";
import {
  item,
  pauseAndExit,
  startEngine,
  until,
} from "./team-engine-helpers.js";
import { isEnd, readsProject } from "./team-engine-reads-helpers.js";
import {
  journalOf,
  makeClock,
  makeHome,
  modeOf,
  sha256,
  snapshot,
  startProject,
  REPO_ROOT,
  TEAM_SRC,
  TOOLS_DIR,
} from "./team-helpers.js";

const THIS_FILE = fileURLToPath(import.meta.url);
const LABEL = "[скрыто]";
const WITHHELD = "Файл не передан: в нём найден секрет";
const SECRET_TEXT = "Файл результата не принят: в нём найден секрет";

// ---- the samples (data) ---------------------------------------------------------------

// Secret-shaped words are never written in one piece in this file: every bait is
// built from parts at run time, and the sample table below is data.
const GHP = "gh" + "p_";
const GHO = "gh" + "o_";
const GHS = "gh" + "s_";
const GHPAT = "github" + "_pat_";
const SKANT = "sk" + "-ant-api03-";
const SKLIVE = "sk_" + "live_";
const AKIA = "AK" + "IA";
const ASIA = "AS" + "IA";
const BEGIN = "-----" + "BEGIN";
const END = "-----" + "END";
const BASIC = "Bas" + "ic";
const EYJ = "ey" + "J";
const ALNUM = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const UPPER = "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8";

// n characters taken in a cycle from a fixed alphabet (letters and digits).
function fill(n, alphabet) {
  let out = "";
  for (let i = 0; i < n; i += 1) out += alphabet[i % alphabet.length];
  return out;
}
const N = (n) => fill(n, ALNUM);
const U = (n) => fill(n, UPPER);

// Rework 08c (AP-110, AP-014): the rules of the requirement that name a closed set or a
// number are tested by the class (every member of the set, both sides of every
// number), not only by the examples of the requirement. The white space of form F2
// is the closed list of the requirement: space, tab, form feed, vertical tab,
// U+00A0, U+1680, U+2000-U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF; the
// two line ends "\n" and "\r" are not skipped (a value does not come from the next
// line). Every character is made from its code, so no blank is typed in this file.
const WS = [
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002,
  0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028,
  0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
].map((code) => String.fromCharCode(code));
const LINE_ENDS = ["\n", "\r"];
const SKIPPED = WS.filter((w) => !LINE_ENDS.includes(w));
// The characters without the ones that an older row of the tables already holds.
const without = (list, ...codes) =>
  list.filter((w) => !codes.includes(w.charCodeAt(0)));
const O27_WS = without(WS, 0xa0); // Authorization:<W>${A}; U+00A0 is O12#14
const O28_WS = without(WS, 0x20); // Authorization: Basic<W>${creds}; the space is O12#6
const O29_WS = without(WS, 0x09, 0x20); // Bearer<W>abc1234; tab and space take the value
const C28_WS = without(SKIPPED, 0xa0, 0x0c); // U+00A0 is C11#15, U+000C is C11#17
const C29_WS = without(SKIPPED, 0x20, 0x2003); // the space is C11#2, U+2003 is C11#16
// Rework 08k (remarks F1-F5 of the extra pass 08j; AP-110): a rule that the requirement
// states as "starts with", "the whole value", "only of", "a run of", "an optional one" or
// "in any case" is held from BOTH sides - against its looser neighbour (contains, the
// first characters, any number) and against its tighter neighbour (exactly one, a
// fixed case). Runs of white space: after the colon of Authorization and after the
// scheme word the requirement says "white-space characters" (a run, members of the
// closed set, mixed); after the word Bearer "one or several spaces or tabs". Every
// character is made from its code.
const ws = (...codes) => String.fromCharCode(...codes);
const RUNS_AUTH = [
  ws(0x20, 0x20),
  ws(0x20, 0x20, 0x20),
  ws(0x09, 0x20),
  ws(0x20, 0x09),
  ws(0x09, 0x09),
  ws(0xa0, 0x2003), // two different members of the closed set
  ws(0x2009, 0x3000, 0xfeff), // three different members
  ws(0x20, 0xa0, 0x09, 0x3000), // four, mixed
];
const RUNS_BEARER = [
  ws(0x20, 0x20, 0x20),
  ws(0x20, 0x20, 0x20, 0x20),
  ws(0x20, 0x09, 0x20),
  ws(0x09, 0x20, 0x09),
  ws(0x09, 0x09, 0x09),
  ws(0x20, 0x20, 0x20, 0x20, 0x20),
];
const QUOTES3 = ["'", '"', "`"];
// The JWT of the sample C6 (three parts) for the rows that put a character before it.
const JWT3 =
  EYJ + "hbGciOiJIUzI1NiJ9." + EYJ + "zdWIiOiJmYWtlIn0.ZmFrZXNpZ25hdHVyZQ";

// Rework 08g (remarks F1, F2 of the second gate; AP-110): a rule that the requirement
// states as a closed list, a set of characters or a number is held member by member,
// and every member has its refused partner where one exists. The lists below are
// copied from the words of the requirement (class V3, V4, the schemes of F2, the
// prefixes of F4-F6), not from the code.
// Class V3 (a bare identifier is an expression): the 26 words of the list.
const V3_WORDS = [
  "string",
  "number",
  "boolean",
  "any",
  "unknown",
  "void",
  "never",
  "object",
  "bigint",
  "symbol",
  "true",
  "false",
  "str",
  "int",
  "float",
  "bool",
  "bytes",
  "dict",
  "list",
  "nil",
  "self",
  "this",
  "await",
  "async",
  "new",
  "function",
];
// F2: the closed list of the schemes.
const SCHEMES = [
  "Basic",
  "Bearer",
  "Digest",
  "Token",
  "Negotiate",
  "NTLM",
  "OAuth",
  "ApiKey",
  "Bot",
];
// After the sign of a name of F9 (not Authorization) only a space and a tab are
// skipped; the other 23 characters of the white space are not (residual risk (5)).
const NOT_SPACE_TAB = without(WS, 0x09, 0x20);
// The keys with a known prefix (F4, F5, F6), each one the shortest that the
// requirement refuses: the minimum after the prefix.
const KEYS = [
  GHP + N(20),
  GHO + N(20),
  GHS + N(20),
  GHPAT + N(20),
  "sk-" + N(16),
  AKIA + U(16),
  ASIA + U(16),
];
// F6: a 16-character body of capitals; the lower-case letter goes to each place in turn.
const AKIA_BODY = "ABCDEFGHIJKLMNOP";
// A literal value (a password, a header value): not a placeholder, not an expression.
const PW = "Qx7Rt2Lm9Zp4";

const KEEP = {
  O1: ["const v = a.b.c; x = obj.prop.method();"],
  O2: ["const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;"],
  O3: ['"version": "0.1.0"', '"1.2.3"', "Версия 1.2.3"],
  O4: [
    "document.documentElement.lang",
    "vendor.min.js",
    "https://api.example.com/v1",
  ],
  O5: ["123e4567-e89b-12d3-a456-426614174000", N(40)],
  O6: ["Authorization: `Bearer ${token}`", "{ token: data.token, user: x }"],
  O7: ["'" + BEGIN + " CERTIFICATE-----'"],
  O8: [
    "postgres://user:password@localhost:5432/db",
    "redis://:${PASSWORD}@host",
    "https://deploy:${DEPLOY_PASSWORD}@host/x",
    "postgres://user:<password>@host/db",
    "postgres://u:$DB_PASS@h/db",
    "postgres://${USER}:${PASS}@h/db",
  ],
  O9: [
    "\ufeffconst a = 1;\r\nlet b = 2;\r\n",
    "no newline at end",
    "Привет, мир ёжик",
    "emoji 😀 ok",
  ],
  O11: [
    BEGIN + " CERTIFICATE-----\nMIIBfake\n" + END + " CERTIFICATE-----\n",
    "const pem = '" + BEGIN + " CERTIFICATE-----\\n' + body;",
  ],
  O12: [
    "Authorization: req.headers.authorization",
    "Authorization: ${AUTH}",
    '"Authorization": "Bearer " + token',
    "'Authorization': 'Bearer ' + tok",
    "Authorization: Bearer <token>",
    "Authorization: Bearer ${{ secrets.TOKEN }}",
    "Authorization: " + BASIC + " ${creds}",
    "Authorization: authHeader",
    "headers.Authorization = `Bearer ${t}`",
    "Bearer token",
    "Authorization: Bearer",
    "Authorization: Bearer\nnextline9x",
    "Bearer \nfoo9bar",
    "Authorization: '${AUTH}'",
    "Authorization:\u00a0${A}",
  ],
  O13: [
    "token = process.env.TOKEN",
    "token: string",
    "const password = await ask();",
    "password: SecretString",
    "passwd=$PASSWD",
    "secret: getSecret()",
    "token=this.opts.token",
    "{ token: data.token}",
    "password: ${{ secrets.DB_PASSWORD }}",
    "TOKEN=$(cat token.txt)",
    "password: process.env.DB_PASSWORD,",
    "api_key = options.apiKey",
    "token: {",
  ],
  O14: [
    "password=",
    'password: ""',
    "password=changeme",
    'password: "changeme"',
    "API_KEY=${API_KEY}",
    'api_key: "YOUR_API_KEY"',
    '"token": "Token"',
    "token=xxxxxxxx",
    "token=***",
    '"password": "Password"',
    'password: "${PASSWORD}"',
    'password: "<your-password>"',
    "password: '{{ password }}'",
    "password: `${process.env.DB_PASSWORD}`",
    'export TOKEN="$(cat ~/.token)"',
  ],
  O15: [
    "max_tokens: 100",
    "token_count=5",
    "the password reset page",
    "secret santa",
    "Authorization header",
    "tokenizer: fast",
    "mypassword: abc",
  ],
  O16: [
    "postgres://postgres:postgres@db:5432/app",
    "mysql://root:root@127.0.0.1:3306/app",
    "mongodb://admin:changeme@mongo:27017",
    "ssh://user:pw-example@host.example/x.git",
  ],
  O17: [
    "sk-short",
    "risk-assessment-overview-2026",
    GHP + "short",
    AKIA + U(15),
    AKIA + U(16) + "Q",
    EYJ + "hbGciOiJIUzI1NiJ9." + EYJ + "zdWIiOiJmYWtlIn0",
    EYJ + "hbGciOiJ." + EYJ + "zdWIiOiJm.ZmFrZXNp.extra",
    "abc.def.ghi",
  ],
  O18: [
    "Authorization: Negotiate ${ticket}",
    "Authorization: NTLM ${creds}",
    "Authorization: OAuth ${oauth}",
    "Authorization: ApiKey ${key}",
    "Authorization: Bot ${botToken}",
  ],
  O19: ["token: opts?.token", "password=this.cfg?.password"],
  O20: [
    "password: ${DB_PASS}",
    "password=${A}",
    "secret=${{A}}",
    "token={{A}}",
    "token=<A>",
    "token: <TOKEN>",
  ],
  O21: ["password=xxx", "token=XXX"],
  O22: ["x" + GHP + N(20), "x" + AKIA + U(16)],
  O23: ["xbearer abc1234"],
  O24: ["password=changeme;x"],
  O25: ["token=${A}}", "secret=${{A}}}"],
  O26: [
    "token=example.com",
    "api_key=YOUR_API_KEY",
    "password=pw-example",
    "token=example9",
    "password=your-token",
    "secret=your9",
    'password: "your-password"',
    "password: 'pw-example'",
    "https://u:pw-example@h/x",
    "https://u:example9@h/x",
    "Authorization: " + BASIC + " YOUR_CREDENTIALS",
    "Bearer YOUR_TOKEN",
  ],
  // O27-O34: added at the rework 08c (remark F1) - the classes of the rules that the
  // requirement states in words (closed set, number, left boundary, name template).
  // F2: every character of the white space after the colon / after the scheme, a
  // template as the value.
  O27: O27_WS.map((w) => "Authorization:" + w + "${A}"),
  O28: O28_WS.map((w) => "Authorization: " + BASIC + w + "${creds}"),
  // F8, residual risk (5): after Bearer only a space or a tab takes the value.
  O29: O29_WS.map((w) => "Bearer" + w + "abc1234"),
  // F8: an underscore or a digit to the left of the word is no boundary.
  O30: ["_bearer abc1234", "9bearer abc1234"],
  // The name template %NAME% (class Sh), next to $NAME.
  O31: ["password=%PASSWORD%", "token=%TOKEN%"],
  // F7: a JWT must not start in the middle of a longer run (a character of the run on the left).
  // The dot belongs to the run too (rework 08o, remark F1 of 08n): "x." + the sample,
  // "." + the sample and "a.b." + the sample are runs of four or more parts, not a token.
  O32: ["x", "_", "9", "-", "x.", ".", "a.b."].map((c) => c + JWT3),
  // F4, F5: one character fewer than the minimum after the prefix.
  O33: [
    GHP + N(19),
    GHO + N(19),
    GHS + N(19),
    GHPAT + N(19),
    "sk-" + N(15),
    "sk-" + N(7) + "_" + N(7),
    "sk-" + N(7) + "-" + N(7),
  ],
  // F3: the character to the left of :// is not one of [A-Za-z0-9+.-].
  O34: ["_", " ", "!"].map((c) => c + "://deploy:" + N(12) + "@host/x"),
  // F2: a line end after the colon / after the scheme ends the line, the next line is not the value.
  // Where the expected side comes from (remark F6 of the second gate): Ф2 lists the characters
  // that are skipped after the colon and after the scheme - 23 of the 25 white-space characters,
  // the two that are not in the list are U+000A and U+000D - and says that the value is the first
  // word after them and that a white-space character ends an unquoted value; Ф8 says that a line
  // end is not a space and the value is not taken from the next line. A character that is not in
  // the list is not skipped, so the value is empty at once (not a literal) for U+000D just as for
  // U+000A. The rows do not rest on a definition of "a line end" outside the requirement.
  O35: LINE_ENDS.flatMap((le) => [
    "Authorization:" + le + "abc1234",
    "Authorization: " + BASIC + le + "dXNlcjpwYXNz",
  ]),
  // O36-O51: added at the rework 08g (remarks F1 and F2 of the second gate) - the closed
  // lists, the sets of characters and the numbers of the requirement, member by member.
  // Class V3: every word of the list is an expression after a name (lower case, then upper case).
  O36: V3_WORDS.map((w) => "secret: " + w),
  O37: V3_WORDS.map((w) => "password=" + w.toUpperCase()),
  // V3: a bare name with "_" and a letter, a lower-case letter directly before an upper-case one.
  O38: [
    "token: foo_bar",
    "token: _a",
    "token: aB",
    "token: fooBar",
    "password=Foo_Bar",
    "token: abC",
  ],
  // V4: each of the five characters that open a block, and a run of all of them.
  O39: [
    "token: [",
    "token: (",
    "token: |",
    "token: >",
    "token: {[(|>",
    "token: >>",
    "password=|",
  ],
  // F2: the schemes Digest and Token, and every scheme of the list in lower and in upper case.
  O40: [
    "Authorization: Digest ${x}",
    "Authorization: Token ${x}",
    ...SCHEMES.map((s) => "authorization: " + s.toLowerCase() + " ${x}"),
    ...SCHEMES.map((s) => "AUTHORIZATION: " + s.toUpperCase() + " ${x}"),
  ],
  // F9: after the sign, spaces and tabs are skipped.
  O41: [
    "password:\t${A}",
    "password=\t${A}",
    "password:\t \t${A}",
    "password=\t\t${A}",
    "password:  ${A}",
  ],
  // F9, residual risk (5): any other white-space character after the sign takes no value.
  O42: NOT_SPACE_TAB.map(
    (w, i) => "password" + (i % 2 ? "=" : ":") + w + "hunter2fake",
  ),
  // Trailing closers are dropped by count: each kind, two in a row, three kinds in a row.
  O43: [
    "token=foo.bar)",
    "token=foo.bar]",
    "token=foo.bar}",
    "token=foo.bar}}",
    "token=foo.bar))",
    "token=foo.bar]]",
    "token=foo.bar)]}",
    "password: data.pass}]",
  ],
  // F7: three parts, but one of them is empty (or the dots at the end are punctuation).
  O44: [EYJ + "a..b", EYJ + "a.b..c", EYJ + "a.b..", EYJ + "a..."],
  // F3: an empty password; white space in the password; a user with "/" or "@" or white space.
  O45: [
    "redis://user:@host",
    "scheme://user:pa ss@host",
    "https://example.com/a:b@c",
    "scheme://us@er:" + PW + "@host",
    "https://deploy:" + PW + "/x@host",
  ],
  O46: WS.map((w) => "https://deploy:" + PW + w + "x@host"),
  O47: WS.map((w) => "https://u" + w + "ser:" + PW + "@host"),
  // F4, F5, F6: a letter and a digit on the left of every prefix are no boundary.
  O48: KEYS.flatMap((key) => ["Q" + key, "7" + key]),
  // F6: a character of [A-Za-z0-9_+=-] on the right of the body takes the key out of the form.
  O49: [
    ..."aZ0_+=-".split("").map((r) => AKIA + U(16) + r),
    ASIA + U(16) + "a",
    ASIA + U(16) + "-",
  ],
  // F6: one lower-case letter anywhere in the 16 characters of the body.
  O50: [
    ...AKIA_BODY.split("").map(
      (c, k) =>
        AKIA + AKIA_BODY.slice(0, k) + c.toLowerCase() + AKIA_BODY.slice(k + 1),
    ),
    ASIA + "a" + AKIA_BODY.slice(1),
    ASIA + AKIA_BODY.slice(0, 15) + "p",
  ],
  // F4: a character outside [A-Za-z0-9_-] cuts the body below 16.
  O51: [".", "/", " "].map((c) => "sk-" + N(8) + c + N(8)),
  // O52-O61: added at the second pass of rework 08g (the sweep of mutants of findSecrets,
  // AP-110): the edges of the rules that the first tables left out. F3 and the groups
  // Sh: a group of one character, a group next to the end of a user name.
  O52: [
    'password: "$(A)"',
    "password: '$(A)'",
    "https://u:$(A)@h",
    "https://u):$(x)@h",
    "https://u}:${x}@h",
    "https://u}}:${{x}}@h",
  ],
  // Sh: the shortest names of $NAME and %NAME%, and the characters of a name.
  O53: [
    "token=%A%",
    "token=$A",
    "token=%_%",
    "token=$_",
    "password=$_A",
    "password=%_A%",
    "password=$a9_Z",
    "password=%a9_Z%",
  ],
  // Class Z: your... and ...example... in every case; the word "your" itself.
  O54: [
    "token=your",
    "token=YOUR",
    "token=yourself",
    "token=eXaMpLe",
    "token=EXAMPLE9",
    "token=myexample",
    "token=examples",
    "Bearer your",
    "password=your_key9",
  ],
  // Quoted values: a name template inside quotes; an escaped quote or an escaped brace
  // inside a group is part of the content (a backslash escapes the next character).
  O55: [
    'password: "$PASSWD"',
    "password: '%PASSWORD%'",
    'token="$TOKEN"',
    'password: "${a\\"b}"',
    "password: '${A\\}'",
    "Authorization: '${AUTH\\}'",
    'password: "${A\\}"',
  ],
  // The count of closers: a closer of another kind is dropped, what stays is a block opener.
  O56: [
    "token: (]",
    "token: [)",
    "token: {)",
    "token: [}",
    "token: (}",
    "token: {]",
    "token: ((",
  ],
  // F2 and F8: a closing quote at the end of the text or glued to the scheme; a scheme with
  // nothing after it; a glued quote that opens a template.
  O57: [
    'Authorization: Bearer"',
    "Authorization: Bot'${x}",
    "Authorization: Negotiate",
    "Authorization: Bot",
    "AUTHORIZATION: NEGOTIATE",
    'Bearer "',
    "Bearer '",
    'Authorization: Basic "',
    "Authorization: Basic '",
  ],
  // A quote that is not closed on its line is an empty string; the next line is not its value.
  O58: [
    'password: "\nhunter2fake"',
    "password: '\r\nhunter2fake'",
    "token: `\nhunter2fake`",
  ],
  // Inside a value that is a whole group nothing is read as a pair or as Bearer; and the
  // line after an unclosed block value starts a new search.
  O59: [
    "TOKEN=$(cat token:txt)",
    "token=${password:x}",
    "Bearer ${bearer abc1234}",
    "token={{ token={{",
    "token={{\ntoken={{x}}",
    "Bearer {{ Bearer {{",
  ],
  // F3: no user, "://" without a scheme, a single slash, an empty password after a separator.
  O60: [
    "https:/deploy:" + PW + "@host",
    "https:deploy:" + PW + "@host",
    "://deploy:" + PW + "@host",
    "redis://:" + PW + "@host",
    "https://deploy:/" + PW + "@host",
    "https://deploy:@" + PW + "@host",
    "https://deploy: " + PW + "@host",
  ],
  // F1 and F7: a marker that is not the marker; a first part that is not eyJ.
  O61: ["-----BEGI", "----" + "BEGIN PRIVATE KEY----", "ey.a.b", "eyK.a.b"],
  // O62-O71 (rework 08k): the stored halves of C59-C70. Each row is paired (PAIRS) with its
  // refused neighbour of the same shape.
  // F2: a RUN of white space after the colon / after the scheme word, then a template.
  O62: RUNS_AUTH.map((r) => `Authorization:${r}\${A}`),
  O63: RUNS_AUTH.map((r) => `Authorization: ${BASIC}${r}\${creds}`),
  // F8: a run of spaces and tabs after the word Bearer, then a template.
  O64: RUNS_BEARER.map((r) => `Bearer${r}\${A}`),
  // F9: ONE optional quote after the name - two quotes in a row are no pair.
  O65: [
    ...QUOTES3.flatMap((a) =>
      QUOTES3.map((b) => `password${a}${b}=hunter2fake`),
    ),
    ...QUOTES3.map((q) => `token${q}${q}: hunter2fake`),
  ],
  // F2: ONE optional opening quote after the colon - a second quote ends the string, the
  // scheme word is not read behind it.
  O66: ['""', "''", "``"].map((q) => `Authorization: ${q}${BASIC} ${PW}`),
  // F8: a letter to the left of the word Bearer in upper and in mixed case is no boundary.
  O67: ["XBearer abc1234", "ZBEARER abc1234", "QbEaReR abc1234"],
  // Z: a chain of x, X, * is the WHOLE value - the same shapes as C65 with the chain alone.
  O69: [
    "token=xxx",
    "password=***",
    "secret=XXX",
    "password: 'xxx'",
    "https://u:xxx@h",
    `Authorization: ${BASIC} xxx`,
    "Bearer ***",
  ],
  // Z: a value that STARTS with your - the same shapes as C66.
  O70: [
    "password=your9abc",
    "token=yourkey",
    "password: 'yourz1'",
    "https://u:your1@h",
    'token="your9"',
  ],
  // F2: the nine scheme words are recognised as a word of their own; C68 puts a character
  // before each one.
  O71: SCHEMES.map((s) => `Authorization: ${s} \${cred}`),
  // O72-O73 (rework 08m, AP-110): a word just OUTSIDE a closed list of the requirement
  // is stored where the list is the one of the old rules (names, key prefixes), and the
  // member of the list next to it is the partner of C73. The requirement lists the names
  // (F9), the prefixes (F4-F6) and the placeholder words as closed.
  O72: [
    "pwd=hunter2fake",
    "api-key=hunter2fake",
    "gh" + "u_" + N(20),
    "AI" + "DA" + U(16),
  ],
  O73: [
    "token: 'pwd'",
    "password=pwd",
    "https://u:pwd@h",
    "token: bool",
    "password=token",
  ],
};

const REFUSE = {
  C1: [
    ["F5", GHP + N(36)],
    ["F5", GHO + N(36)],
    ["F5", GHS + N(36)],
  ],
  C2: [["F5", GHPAT + N(22)]],
  C3: [["F4", SKANT + N(28)]],
  C4: [
    ["F6", AKIA + U(16)],
    ["F6", ASIA + U(16)],
  ],
  C5: [
    [
      "F1",
      BEGIN +
        " RSA PRIVATE KEY-----\nMIIfake\n" +
        END +
        " RSA PRIVATE KEY-----",
    ],
    ["F1", BEGIN + " PRIVATE KEY-----\nMIIfake"],
  ],
  C6: [
    [
      "F7",
      EYJ + "hbGciOiJIUzI1NiJ9." + EYJ + "zdWIiOiJmYWtlIn0.ZmFrZXNpZ25hdHVyZQ",
    ],
  ],
  C7: [["F3", "https://deploy:S3cr3tPassw0rd@example.com/x"]],
  C8: [["F9", "password=hunter2fake"]],
  C9: [["F2|F8", "Authorization: Bearer " + N(36)]],
  C10: [
    ["F1", BEGIN + " OPENSSH PRIVATE KEY-----"],
    ["F1", BEGIN + " ENCRYPTED PRIVATE KEY-----"],
    ["F1", BEGIN + " PGP PRIVATE KEY BLOCK-----"],
    ["F1", BEGIN + " FAKE THING-----"],
    ["F1", BEGIN + " PUBLIC KEY-----\nMIIfake\n" + END + " PUBLIC KEY-----"],
    ["F1", BEGIN + " CERTIFICATE REQUEST-----"],
    ["F1", BEGIN + " CERTIFICATE"],
    ["F1", BEGIN + " certificate-----"],
    ["F1", 'text.indexOf("' + BEGIN + '", pos)'],
    ["F1", "-" + BEGIN + " CERTIFICATE-----"],
    ["F1", BEGIN + " CERTIFICATE------"],
  ],
  C11: [
    ["F2", "Authorization: " + BASIC + " dXNlcjpwYXNzd29yZA=="],
    ["F2", "authorization=Zm9vYmFyYmF6MTIz"],
    ["F2", "Authorization: " + BASIC + " dXNlcjpwYXNz"],
    ["F2", "Proxy-Authorization: " + BASIC + " dXNlcjpwYXNz"],
    ["F2|F8", "Authorization: Bearer abc1234"],
    ["F2", "Authorization: Token abcdef"],
    ["F2", "Authorization: Digest username=fake"],
    ["F2", "Authorization: hunter"],
    ["F2", "Authorization: header"],
    ["F2", "Authorization: " + BASIC + " authHeader"],
    ["F2|F8", '"Authorization": "Bearer ' + N(36) + '"'],
    ["F2", '"Authorization": "' + BASIC + ' dXNlcjpwYXNzd29yZA=="'],
    ["F2", "'Authorization': '" + BASIC + " dXNlcjpwYXNzd29yZA=='"],
    ["F2", "`Authorization`: `" + BASIC + " dXNlcjpwYXNzd29yZA==`"],
    ["F2", '"Authorization": "authHeader"'],
    ["F2", "Authorization:\u00a0abc1234"],
    ["F2", "Authorization: " + BASIC + "\u2003dXNlcjpwYXNz"],
    ["F2", "Authorization:\u000cabc1234"],
    ["F2", "Authorization:\u000b" + BASIC + " dXNlcjpwYXNz"],
  ],
  C12: [
    ["F8", "Bearer " + N(40)],
    ["F8", "Bearer abc1234"],
    ["F8", "Bearer abcdefghijklmnopqrst"],
    ["F8", "Bearer authentication"],
    ["F8", "Bearer\tabc1234"],
  ],
  C13: [
    ["F9", "API_KEY=" + SKLIVE + "4eC39HqLyjWDarjtT1zdp7dc"],
    ["F9", "DB_PASSWORD=hunter2fake"],
    ["F9", "my-secret=Zx81qLm92Vb"],
    ["F9", "token=abc123def4"],
    ["F9", "passwd=hunter2fake"],
    ["F9", "password=changeme2"],
    ["F9", "DB_PASSWORD=P@ssw0rd!"],
    ["F9", "SECRET=Sup3r!Secret#2026"],
    ["F9", "password=Pa$$w0rd"],
    ["F9", "token=ya29.a0AfH6SMBx1234567890abcdefghijk"],
    ["F9", "secret=abc"],
    ["F9", "password=hunter"],
    ["F9", "password=Hunter"],
    ["F9", "token=data.token2"],
    ["F9", "token: tok"],
    ["F9", "password: $uper$ecret1"],
    ["F9", "{ token: abcdef12, user: x }"],
  ],
  C14: [
    ["F9", 'api_key: "abc123"'],
    ["F9", '"apikey": "abcdef12"'],
    ["F9", "secret: 'x'"],
    ["F9", 'password: "changeme2"'],
    ["F9", 'password: "wrong-password"'],
    ["F9", 'password: "p<ss>w0rd"'],
    ["F9", 'password: "a>b"'],
    ["F9", 'password: "p${x}w0rd"'],
    ["F9", 'password: "p{{x}}w0rd"'],
    ["F9", "{'password': 'hunter2fake'}"],
    ["F9", "{`password`: `hunter2fake`}"],
    ["F9", "{ token: 'a' }"],
    ["F9", '"password": "Пароль"'],
    ["F9", '"password": "Enter your password"'],
    ["F9", '"token": "Invalid token"'],
    ["F9", "Unexpected token: '%0'"],
  ],
  C15: [
    ["F3", "postgres://app:Pr0dPassw0rd@db:5432/app"],
    ["F3", "https://deploy:Pa$$w0rd@example.com/x"],
    ["F3", "https://deploy:p{ss}w0rd1@example.com/x"],
    ["F3", "https://deploy:p<ss@example.com/x"],
    ["F3", "https://имя:имя@h"],
    ["F3", "postgres://app:app@db/x"],
  ],
  C16: [
    ["F2", "Authorization: Negotiate YIIHbQYGKwYBBQUCoII"],
    ["F2", "Authorization: NTLM TlRMTVNTUAABAAAA"],
    ["F2", "Authorization: OAuth 2YotnFZFEjr1zCsicMWpAA"],
    ["F2", "Authorization: ApiKey abcdef123456"],
    ["F2", "Authorization: Bot MTIzNDU2Nzg5MDEyMzQ1Njc4"],
  ],
  C17: [
    ["F9", "token=opts?.token2"],
    ["F9", "password: cfg?.pass9"],
  ],
  C18: [
    ["F9", "password: ${\nhunter2fake}"],
    ["F9", "secret=${{\nhunter2fake}}"],
    ["F9", "token: <\nhunter2fake>"],
  ],
  C19: [
    ["F9", "password=${}"],
    ["F9", "secret=${{}}"],
    ["F9", "token={{}}"],
    ["F9", "token=<>"],
  ],
  C20: [
    ["F9", "token=<a<b>"],
    ["F9", "password=${{ a }"],
  ],
  C21: [
    [
      "F7",
      EYJ + "hbGciOiJIUzI1NiJ9." + EYJ + "zdWIiOiJmYWtlIn0.ZmFrZXNpZ25hdHVyZQ.",
    ],
  ],
  C22: [
    ["F9", "password=xx"],
    ["F9", "secret=**"],
  ],
  C23: [["F6", "_" + AKIA + U(16)]],
  C24: [["F9", "password=hunter2fake;example"]],
  C25: [["F9", "token=hunter2fake}"]],
  C26: [
    ["F9", "token=" + N(12) + "&redirect=https://example.com/cb"],
    ["F9", "secret=" + N(12) + "@example.com"],
    ["F9", 'password: "' + N(12) + ' for example.com"'],
    ["F2", "Authorization: " + BASIC + " " + N(24) + "&x=example"],
    ["F8", "Bearer " + N(24) + "&redirect=example.com"],
    ["F3", "https://deploy:" + N(12) + "&example@host/x"],
    ["F9", "password=your&" + N(12)],
    ["F9", "api_key=your/" + N(12)],
    ["F3", "https://deploy:your:" + N(12) + "@host/x"],
    ["F9", 'password: "your ' + N(12) + '"'],
    ["F8", "Bearer your:" + N(24)],
    ["F9", "token=example.com&" + N(12)],
    ["F9", "password=your-token&" + N(12)],
    ["F3", "https://u:pw-example&" + N(12) + "@h/x"],
    ["F9", "password: 'pw-example for " + N(12) + "'"],
    ["F2", "Authorization: " + BASIC + " YOUR_CREDENTIALS&" + N(24)],
    ["F8", "Bearer YOUR_TOKEN&" + N(24)],
  ],
  // C27-C34: added at the rework 08c (remark F1), the refused halves of the pairs of O27-O34.
  // F8: the bare identifier (class V3) does not apply after Bearer.
  C27: [
    ["F8", "Bearer authHeader"],
    ["F2|F8", "Authorization: Bearer authHeader"],
  ],
  // F2: every character of the white space after the colon, a literal as the value.
  C28: C28_WS.map((w) => ["F2", "Authorization:" + w + "abc1234"]),
  // F2: every character of the white space after the scheme, a literal as the value.
  C29: C29_WS.map((w) => [
    "F2",
    "Authorization: " + BASIC + w + "dXNlcjpwYXNz",
  ]),
  // F8: no letter, digit or underscore to the left of the word; any case.
  C30: [
    "bearer abc1234",
    "-bearer abc1234",
    ".bearer abc1234",
    "(bearer abc1234",
  ].map((text) => ["F8", text]),
  // The template %NAME% needs a name that starts with a letter or "_", a closing %, and
  // nothing around it.
  C31: [
    "password=%1PASSWORD%",
    "token=%TOKEN",
    "token=$1TOKEN",
    "password=p%X%w",
  ].map((text) => ["F9", text]),
  // F7: a separator (not a character of the run) before the JWT.
  C32: [
    ["F7", "(" + JWT3],
    ["F7", '"' + JWT3 + '"'],
    ["F7", "=" + JWT3],
    ["F7", " " + JWT3],
  ],
  // F4, F5: the minimum after the prefix.
  C33: [
    ["F5", GHP + N(20)],
    ["F5", GHO + N(20)],
    ["F5", GHS + N(20)],
    ["F5", GHPAT + N(20)],
    ["F4", "sk-" + N(16)],
    ["F4", "sk-" + N(8) + "_" + N(8)],
    ["F4", "sk-" + N(8) + "-" + N(8)],
  ],
  // F3: a character of [A-Za-z0-9+.-] to the left of ://.
  C34: ["a", "9", "+", ".", "-"].map((c) => [
    "F3",
    c + "://deploy:" + N(12) + "@host/x",
  ]),
  // C35-C45: added at the rework 08g (remarks F1 and F2), the refused partners of O36-O51.
  // V3: the word of the list with one more letter is a literal.
  C35: V3_WORDS.map((w) => ["F9", "secret: " + w + "x"]),
  C36: [
    "token: ___",
    "token: _",
    "token: Ab",
    "token: AB",
    "token: ABc",
    "token: foo_bar9",
    "token: foo-bar",
  ].map((text) => ["F9", text]),
  // V4: characters that are not in the set of five.
  C37: ["token: <", "token: -", "token: {a", "token: |x"].map((text) => [
    "F9",
    text,
  ]),
  // F2: a word that is not in the list is no scheme (it is the first word, a literal); a
  // literal after each scheme.
  C38: [
    ...[
      "Authorization: Basics ${x}",
      "Authorization: Digests ${x}",
      "Authorization: Negotiat ${x}",
      "Authorization: Bo ${x}",
    ].map((text) => ["F2", text]),
    ...SCHEMES.map((s) => [
      s === "Bearer" ? "F2|F8" : "F2",
      "AUTHORIZATION: " + s.toUpperCase() + " " + PW,
    ]),
  ],
  C39: [
    "password:\thunter2fake",
    "password=\t hunter2fake",
    "password:\t \thunter2fake",
    "password:  hunter2fake",
  ].map((text) => ["F9", text]),
  // Closers that have a pair are not dropped, text after them is part of the value.
  C40: [
    "token=(foo.bar)",
    "token=[foo.bar]",
    "token={foo.bar}",
    "token=foo.bar)x",
  ].map((text) => ["F9", text]),
  C41: [
    ["F7", EYJ + ".a.b"],
    ["F7", JWT3 + ".."],
    ["F7", JWT3 + "..."],
    ["F7", EYJ + "a.b.c"],
  ],
  C42: [
    ["F3", "https://a:b:" + PW + "@host"],
    ["F3", "https://deploy:a@host/x"],
    ["F3", "https://deploy:" + PW + "@host"],
  ],
  // F4, F5, F6: a character that is not a letter or a digit on the left (each prefix).
  C43: [
    ...KEYS.flatMap((key, i) =>
      ["-", "="].map((c) => [i < 4 ? "F5" : i === 4 ? "F4" : "F6", c + key]),
    ),
    ...KEYS.flatMap((key, i) =>
      i === 5 ? [] : [[i < 4 ? "F5" : i === 4 ? "F4" : "F6", "_" + key]],
    ),
  ],
  // F6: a character outside [A-Za-z0-9_+=-] on the right.
  C44: [
    ...[".", " ", "/", ",", ")", "\n", "!"].map((r) => [
      "F6",
      AKIA + U(16) + r,
    ]),
    ["F6", ASIA + U(16) + "."],
  ],
  // F6: a body of capitals only, of digits only.
  C45: [
    ["F6", AKIA + AKIA_BODY],
    ["F6", AKIA + "0123456789012345"],
    ["F6", ASIA + AKIA_BODY],
  ],
  // C46-C55: the refused halves of O52-O61.
  C46: [
    'token="$()x)"',
    "https://u:$()x)@h",
    'export TOKEN="$()cat ~/.token)"',
    'token="$()"',
    "https://u:$()@h",
  ].map((text) => ["F9|F3", text]),
  // An opener without its closer, inside quotes and as the password of an address.
  C47: [
    'password: "${a',
    "password: '{{a",
    'password: "$(a',
    'password: "<a',
    'password: "${{a}',
    "https://u:${a@h",
    "https://u:$(a@h",
    "https://u:{{a@h",
    "https://u:<a@h",
    "https://u:${{a}@h",
  ].map((text) => [text.startsWith("https") ? "F3" : "F9", text]),
  // Sh: a name that is not a name.
  C48: [
    "token=$",
    "token=%",
    "token=%%",
    "token=%A",
    "token=%9%",
    "token=$9",
    "token=%A-%",
  ].map((text) => ["F9", text]),
  // Class Z: one character wrong in "your" or in "example"; a character outside the set.
  C49: [
    ..."example"
      .split("")
      .map((c, k) => [
        "F9",
        "token=" + "example".slice(0, k) + "9" + "example".slice(k + 1),
      ]),
    ..."your"
      .split("")
      .map((c, k) => [
        "F9",
        "token=" + "your".slice(0, k) + "9" + "your".slice(k + 1),
      ]),
    ["F9", "token=exampl"],
    ["F9", "token=xample"],
    ["F9", "token=you"],
    ["F9", "token=-our9"],
    ["F9", "token=)example9"],
    ["F9", "token=@example9"],
    ["F9", "token=example@"],
    ["F9", "token=your@"],
  ],
  // V1: a "?" that is not "?.".
  C50: [
    "secret: d?ct",
    "token=a?b.c",
    "token=a.b?c",
    "token=a?",
    "token=a?.",
  ].map((text) => ["F9", text]),
  // The count of closers: a pair is not dropped; only trailing closers are.
  C51: [
    "token={{ token={{/",
    "token: ()",
    "token: []",
    "token: {}",
    "token: {[]}",
    "token: (|)",
    "token=data.token)x)",
    "token=data.token]x]",
    "token=data.token}x}",
  ].map((text) => ["F9", text]),
  // F8 and F2: a value of one character at the end of the text; a quote that opens.
  C52: [
    ["F8", "Bearer X"],
    ["F8", "Bearer\ta"],
    ["F8", "Bearer /"],
    ["F8", 'Bearer "x'],
    ["F8", "Bearer 'x"],
    ["F8", "Bearer `x"],
    ["F2", "Authorization: " + BASIC + " X"],
    ["F2", "Authorization: " + BASIC + ' "x'],
    ["F2", "Authorization: Bot $"],
    ["F2", "Authorization: Bot '{x}"],
    ["F2", "Authorization: Negotiate${x}"],
    ["F2", "Authorization: Bot${x}"],
  ],
  // F8: more than one space or tab after the word.
  C53: [
    "Bearer  abc1234",
    "bearer  bc1234",
    "Bearer \tabc1234",
    "Bearer\t\tabc1234",
  ].map((text) => ["F8", text]),
  // A secret glued to the closing quote of a kept quoted value is still read (the scan
  // goes on right after the closing quote).
  C55: [
    'password: "${A}"token=hunter2fake',
    'token="***"password=hunter2fake',
  ].map((text) => ["F9", text]),
  // Sh (rework 08i, F1): a template is the WHOLE value, so a group with text AFTER its
  // closer is a literal - in a quotation, after a scheme or Bearer, and in the password of
  // an address. Each row is paired (PAIRS) with a stored row whose group stands alone.
  // F9, a quotation after a name (and one unquoted pair of two groups in a row).
  C56: [
    'password: "${x}w0rd"',
    "password: '<A>" + "hunter" + "2fake'",
    'password: "$(A)tail"',
    'password: "{{A}}hunter"',
    'password: "${{ A }}x"',
    'password: "%A%x"',
    "password: `${A}x`",
    'password: "${A}${B}"',
    "token=${A}${B}",
    "password: '$A.x'",
  ].map((text) => ["F9", text]),
  // F2 and F8: a quotation, or a value, after a scheme and after Bearer.
  C57: [
    ["F2", 'Authorization: Basic "${x}y"'],
    ["F2", "Authorization: Basic '<A>x'"],
    ["F2", 'Authorization: Basic "$(A)x"'],
    ["F2", 'Authorization: Basic "{{A}}x"'],
    ["F2", 'Authorization: Basic "${A}${B}"'],
    ["F2", "Authorization: Basic ${A}tail"],
    ["F8", 'Bearer "${x}y"'],
    ["F8", "Bearer '<A>x'"],
    ["F8", 'Bearer "{{A}}x"'],
  ],
  // F3: the password of an address is a group and then more characters.
  C58: [
    "https://u:${A}" + "hunter" + "2fake@h",
    "https://u:<A>x@h",
    "https://u:$(A)x@h",
    "https://u:{{A}}x@h",
    "https://u:${A}${B}@h",
    "https://u:${{A}}x@h",
    "https://u:%A%x@h",
    "https://u:$A.x@h",
  ].map((text) => ["F3", text]),
  // C59-C70 (rework 08k, AP-110): the refused halves of O62-O71 and the neighbours of the
  // rules "starts with", "the whole value", "only of", "a run of", "any case".
  // F2: a RUN of white space after the colon / after the scheme, then a literal.
  C59: RUNS_AUTH.map((r) => ["F2", `Authorization:${r}${PW}`]),
  C60: RUNS_AUTH.map((r) => ["F2", `Authorization: ${BASIC}${r}${PW}`]),
  // F8: a run of spaces and tabs after Bearer, then a literal.
  C61: RUNS_BEARER.map((r) => ["F8", `Bearer${r}abc1234`]),
  // F9: ONE quote after the name is still a pair (partners of O65).
  C62: [
    ...QUOTES3.map((q) => ["F9", `password${q}=hunter2fake`]),
    ...QUOTES3.map((q) => ["F9", `token${q}: hunter2fake`]),
  ],
  // F2: ONE opening quote and then the scheme word (partners of O66); and two quotes of
  // different kinds - the first one opens a string that is not closed on its line, so the
  // whole rest of the line is one non-empty quotation.
  C63: [
    ...QUOTES3.map((q) => ["F2", `Authorization: ${q}${BASIC} ${PW}${q}`]),
    ["F2", `Authorization: "'${BASIC} ${PW}`],
    ["F2", `Authorization: '"${BASIC} ${PW}`],
  ],
  // F8: the word Bearer in any case.
  C64: [
    ["F8", "BEARER abc1234"],
    ["F8", "bEARER abc1234"],
    ["F8", "BeArEr abc1234"],
    ["F8", "BEARER\tabc1234"],
  ],
  // Z: a chain of x, X, * followed by more characters is a literal - in each place a
  // value is read (unquoted, in quotes, the password of an address, after a scheme and
  // after Bearer). Same order as O69.
  C65: [
    ["F9", "token=xxxhunter2fake"],
    ["F9", "password=***abc"],
    ["F9", "secret=XXXq1w2e3"],
    ["F9", "password: 'xxxabc9'"],
    ["F3", "https://u:xxxQx7Rt2Lm9@h"],
    ["F2", `Authorization: ${BASIC} xxxabc9`],
    ["F8", "Bearer ***abc9"],
  ],
  // Z: a character BEFORE your - the value does not start with it. Same order as O70 and
  // the rows O26#10, O26#11.
  C66: [
    ["F9", "password=Xyour9abc"],
    ["F9", "token=myyourkey"],
    ["F9", "password: 'Zyourz1'"],
    ["F3", "https://u:Zyour1@h"],
    ["F2", `Authorization: ${BASIC} ZYOUR_CREDENTIALS`],
    ["F8", "Bearer ZYOUR_TOKEN"],
    ["F9", 'token="9your"'],
  ],
  // V3: a letter before a word of the list is no word of the list (C35 puts one after).
  C67: V3_WORDS.map((w) => ["F9", `secret: x${w}`]),
  // F2: a digit before a scheme word is no scheme word (the value is then that word).
  C68: SCHEMES.map((s) => ["F2", `Authorization: 9${s} \${cred}`]),
  // Sh: a name template that is longer than a few characters and then more characters.
  C69: [
    ["F3", "https://u:$ABCDEFGHI.x@h"],
    ["F3", "https://u:%ABCDEFGHI%x@h"],
  ],
  // F9: a quotation of blanks only holds something - it is not an empty string (partner:
  // O14#1, a pair of quotes in a row).
  C70: [
    'password: " "',
    "password: ' '",
    "password: ` `",
    'password: "\t"',
    'password: "  "',
    `token: '${ws(0xa0)}'`,
  ].map((text) => ["F9", text]),
  // B4: a value of block characters only; a letter or a digit among them (or behind
  // them, or before them) makes a literal.
  C71: [
    "token: (((hunter2fake",
    "token: [[[hunter2fake",
    "token: |||x7Rt2Lm9",
    "token: ((((((((x",
    "token: hunter2fake[[[",
    "token: x7Rt2Lm9>>>",
  ].map((text) => ["F9", text]),
  // F7: three short parts and dots at the end.
  // F1: the one stored header has EXACTLY ONE space between BEGIN and CERTIFICATE (partner
  // O7#0): two spaces, a tab, a tab and a space, a space and a tab, three spaces, a
  // no-break space, none.
  C72: ["  ", "\t", "\t ", " \t", "   ", ws(0xa0), ""].map((gap) => [
    "F1",
    "'-----BEGIN" + gap + "CERTIFICATE-----'",
  ]),
  // C73 (rework 08m): a word just outside a closed list is not a member (decisions/0102
  // items 22(б) and 30: the list of placeholders stays closed, `pw` and `tok` are
  // refused; the schemes and the types are closed lists, a word outside them is a
  // literal). Partners: O73 and O71#0.
  C73: [
    ["F9", "token: 'pw'"],
    ["F9", "password=pw"],
    ["F3", "https://u:pw@h"],
    ["F9", "token: char"],
    ["F9", "password=tok"],
    ["F2", "Authorization: Hmac ${cred}"],
  ],
  C54: [EYJ + "a.b.9.", EYJ + "a.b.c.", EYJ + "a.b.c.."].map((text) => [
    "F7",
    text,
  ]),
};

// sha256 of the bytes of every sample, taken with the command shasum -a 256 on the
// bytes themselves (not with the code under test).
const SHA = {
  "E:g-O1": "70586b2059bc6493d2387f4979e441a79f719ae96ed835a17a3b8780f7a6d505",
  "E:g-O11": "0076a4b161570903f242ec88d31720be846bb7e0482a4ab9da7eb96c3e88ab15",
  "E:g-O12": "2ea01e14675fc74b49710347f730ef2328eae1940f94b5146995cea013fee2c9",
  "E:g-O13": "043d2083d9202f0c9edbf6d9be29c2a1336b01e2e469927c4dd5ca703f3fb023",
  "E:g-O14": "94bec24edcbeaeb662e494ba9e6c3b161f0a1b034115810d758653345abeb324",
  "E:g-O15": "59ad6753ffd0cc7199647a1e6d6dadf130c45efe3f1ef745918440800e3d8fb8",
  "E:g-O16": "d8b54d85c4548906841a25945c51f0f74d37d15be72ac074ff846e558867b146",
  "E:g-O17": "42873fb123cee1e86c1deb0bae39d6123869915646afe6a29b039b9d8e67212f",
  "E:g-O18": "11ad065ae33d3241b3b6ed5b45e4c78fc8053dc08319e36c98098a9ae310e8dd",
  "E:g-O19": "4e934f4e9aa7fd2cf5eee862597d10afaa0d0a611d759a63d1a4db217af49ad1",
  "E:g-O2": "a80e31d476602d81c426db0ed51430aa8195e8449a8a8b5f7864636aa539f4a7",
  "E:g-O20": "14427806785305a832e21fcf2f3bd1e36d5c3af084b1c7ceea4729227e1c256c",
  "E:g-O21": "047ab81db1fe1d680e01f4d7eaf2d6d8a9ee1b23bd7657dd1176494abf41bd96",
  "E:g-O22": "9d4d7cf2d4c14bce10b36a357dad4b3889b4a91f4af3a49bd59d5c230f7d978f",
  "E:g-O23": "a4b3d48d6e1385449fc73ff02dad91c620a5748d5a6ba40b9ac6e55eb0c43fdb",
  "E:g-O24": "8a63492eb25dfc39f7970d33f91a9daa088b9bd4b984727253d35eb580c51a79",
  "E:g-O25": "1855e3feba8dddc36948d4e75b5d4ab5258a220040d2a4610ce946b5862864f9",
  "E:g-O26": "53aed9cba9ef90851c970f4a01f67a4e40e513774b95ec5a3e416c85ee49e97f",
  "E:g-O27": "96181a55d48a2f6ca4dbc384da32897bc9063131f450f46da061a5282c0b2a2c",
  "E:g-O28": "c2672b52fb5ce97e7a579865117cdf321da5d9529c9cd074c4389dd30f9ce77c",
  "E:g-O29": "0b11ca387c093e82acd89e8df0642ef0a7367f908ae797bcf90d4eccfd51d347",
  "E:g-O3": "c08c9b8d239af8a6af89f8333324d4aea8bb5515fd713bf61e2213ad08ed586a",
  "E:g-O30": "e64587cb2da8e2f45ea7085f3c17fdb82b376ff3979ac4b7d46dc417acf34f1a",
  "E:g-O31": "f3d0b948ef1fe5b2359564756c5a507e98ea5eaf2b7b439989df9494d659c0d4",
  "E:g-O32": "20c2942bc11a9c9e82ec95742500459df00b4d660845a44b0624598d0425b7c0",
  "E:g-O33": "a9ba557e8ed49952688f2a43845ca4faec63a147f89f3009499e8237431787de",
  "E:g-O34": "eb38da9693f03e57226a1b68e3ae3756f4a3c5e298db4fb42f403cd77920f9bf",
  "E:g-O35": "fc2f7fdfbc4a5c7d2405e23333f6e568bf4e8c2befa259ba8f716705454a054e",
  "E:g-O4": "a3fb514bcf44532199339c42a7e1172a605e907ec5dc7b0583a1bd6c0a8cf437",
  "E:g-O5": "e4165dbaa3dcc0bc1807cb0919023af39328bb2b0a34960e7164b6c26fffa157",
  "E:g-O6": "d01cc07dc0d848d2c540a530d72aad98089bac9247d2b5197a4a0e31b45e94b8",
  "E:g-O7": "a813dbc8179aadb48a229abfc817bf07345789ec541bb53316bbd03384fe6823",
  "E:g-O8": "030268c3c21be6bcc370d599f936fd5f47385a047a94946213fd8b0040d18eea",
  "E:g-new": "74ddf90b5dac3c74eb971f8eea9e90aa202750f57bdc946a59aa16b7344f7633",
  "E:long": "570f03beca7cefb57de4e7a1a0376d30c94afc5a7820f278c43c11aff5e634af",
  "E:o10": "eddee196646366b092eb98e1590064c601b61f01e98552b087896aee4f2355d2",
  "E:o9-0": "3a235001e0edd04ef7eeca003f24f3cc1a872e62cd6d36ba93f9237eb3da79b0",
  "E:o9-1": "fb6a17a09578175d2f04634b6639304ab0efdaf4ff2f94078797653a61a1fd62",
  "E:o9-2": "8882abea9e25e5ef3b4caec397fab33376a79a5ab090c50aa9c2f3e0abdc90c3",
  "E:o9-3": "21f070bfc29420afdc03d39927d748b1e66a414beb70ec41de7ce0932794dfb3",
  "O1#0": "323e922698a26e84d8fd48c3c24ff53066f2153448a3103f56496517d139a831",
  "O11#0": "848814ab71e579220d47348da4e53a440bdcc4aef1b763c673ba955d911a268d",
  "O11#1": "a5ac0cf0e0a694afae234c5664824a419951e58f54b6711aa70ea88c28242642",
  "O12#0": "78e3128129bea06083706cdd87266bf6593b273ec6b4bf9aa15e995851fc051e",
  "O12#1": "fc5c26bef5c3e678c6705b4d1a9c6802eb358f2c850bfc1df68a3362ccbb8d70",
  "O12#10": "877bd9039096fd897e1aa1830313956b8c6978033eedeabe18afb57b26c4cc02",
  "O12#11": "7c4fca3af05036ce6233acbb7dead6d010de80b5cb7cbc7f45ba3d49104bb304",
  "O12#12": "c8fdf5d8f64cb01cfb4cd49073d23b3fa2f3da82a1156d16295ecbfe5c83a83c",
  "O12#13": "6cf0470a0b9146dbd73d8e01330550ae518d92cbe3d7eb97ace31acc939368f9",
  "O12#14": "91352d408c49a063f920584c8d9138c5e117e4f56415631310574abbfa8cc860",
  "O12#2": "89a781e86277f4e49db0b6d30776b44b480bb8187b5401a4e0492d90f3c4ab2e",
  "O12#3": "a9e4e95d5893e3105fe95f1899c4852f3ecd6d1a4296beb91f38490ce9b5543c",
  "O12#4": "078298af268708b4996c5f47bb5242f98e58dff587417c2c5d531c73ea8ed999",
  "O12#5": "5c0c82453c9026da6bc1e02deca5a4ecbd1ca50f6ccb36eedaf907e16fc95224",
  "O12#6": "ab7828643a22881a9104713734446dedc6bc3719fea8715320f6417bdf8db721",
  "O12#7": "32a908f2d2aa7e1a9d82f7ba5e1ab5532d8fd7ad8c2b52ae82d93d2cfe5fdd34",
  "O12#8": "ffacdad3b7862a177c52560fbbf3b8654145aa431918fb9a8af814b9a8734ae3",
  "O12#9": "b22ac30e61f624d5d9ecfaec62edc932976e15d2f1599809297f5422ed3b396b",
  "O13#0": "563adc9b11232668a5cf0a5b821e3847a2064d86a701a60e1848c109fcddec0d",
  "O13#1": "05f47b4c9d8aef11fadc43b34f5fcadfbf5ec2d0a415cd5b6646087613dffa57",
  "O13#10": "4b5fd0afeebbbca2dd08f78836999dae243febd18e7add95f38cffa53a519b51",
  "O13#11": "dfe925becd190410e072288a309a78a504260548e132a9a6e1bdb7b79588a9af",
  "O13#12": "cda2fcab33850ec1ab25f2484f56781f9ce7742b7ffd3195b8a7ccb0ccfe30bf",
  "O13#2": "4686786f5d4c03612a5fed1fd63e342e5a374bf9c91f7bad3d7b2c7ca1817554",
  "O13#3": "73ce695730c1db750376fd20dfe82f7e3e6b3ecd925efcd2b04d293ee5ef132e",
  "O13#4": "007a1234335d04703ec91d1ecfe011a2fdc71098be46c79dea0c98f6462a27be",
  "O13#5": "7d14e829ae6942348cd8208a5417b032d553bfe8874610bf7abb4c19edd3b6d9",
  "O13#6": "fcf52f047e6c9f999623029becba29f6912728516f3c589fef0d1a2ebdae1e47",
  "O13#7": "ae0894c27d221bf34342c9f4228f882e7b8da51fa242e826ecd3195a3ab07dd3",
  "O13#8": "3798964c7b1a0b886117b6a694acc244d52fbfc2018ddaf1c5cf428b6d4cd6ad",
  "O13#9": "884055fd8c12d3f4a7c8319bb5f8e0bbc0f641b7171680d367a905b0ae4d66b2",
  "O14#0": "a184fed6cfdd97ed2f26ab97ac6d70e76ba6c6fdab5a1df9a557aca8cb971645",
  "O14#1": "3184a50d0d6b9dd96c889b45312b55ef408db0d600153870995d68fb1eb6d0fd",
  "O14#10": "7bd3a7eba117371b2423c337dd8e2796cf2b99bc632b4094f19cd69920e53e40",
  "O14#11": "64b187f08ee0fe3b76bc0810e7d4ec04f1556cc3219f05b2834d1db650bd0cef",
  "O14#12": "253113c4105787595e7cc1f4cbb846a7c5ec34f8a2ce24d882b4a9f02bd1d60e",
  "O14#13": "55a5a00add7981b119d36b863e7fa92bb0d1b62c606a3a8d1fca4de73b1affdc",
  "O14#14": "22f21ecf3c319d589cced790f2bb1880fc272c60bad89ef21bc62b6687649b10",
  "O14#2": "88761c236bd48ddafc99e7ab795cbd1f041b27c14e77ff201347c5a5ef340903",
  "O14#3": "988386724acaff9bd197124f8a521aa00ac58493dfa3771b9c5eec1f67ec47a3",
  "O14#4": "ad464da9f047a06da6156bd88e8551d16ff8ed8d8aa4596a8540235b2f22c7e0",
  "O14#5": "0dda63af4283ebe9dec05cfc15d654a605b564817ad40c312ac1b103d654ebc8",
  "O14#6": "1820c8c99447a6eb2198132f2b830cddc9542b192400d5219a7256bc4398c5b5",
  "O14#7": "ecd7aff7c3b835600e2dcbb17a34cc73dda8809d20b34271f845466053cb9ad9",
  "O14#8": "0f8accc892f8d1d609aee0c86cb259eeb01aeb4c77acf56da68114198117c46d",
  "O14#9": "d2daa50bb502fcf826170ac0c48476ef5314d8f60a67b6a0dda2a56b860563bc",
  "O15#0": "eb53fccce696772f0bb55e372e538886f2b458d1da2572a003a33200c494aa31",
  "O15#1": "26046c72ed420a6503e680c0bb034f62b3698bf203db4b53f2ad77447f12adc0",
  "O15#2": "7791c49bff05ad1fd5c4f70e4cd6117e79f2576d29c5f2c6adc1ffd5e6137569",
  "O15#3": "d6a10f1fd623b4ba7e9c8552b654dee47cb2195583132d95e0e54ff97661c585",
  "O15#4": "8e68075cabda5ea7fe0a4e3bd15cd4b6512758d3e021969b08b2566599aaf02f",
  "O15#5": "27e337b6ff59d3269d07549147b4f536f5f334bb5fd243bfacc1712124e3b771",
  "O15#6": "4cfd24c0a1c467c2e393daa71cea0c228d4e1ece7850b95fa9022d5823aae689",
  "O16#0": "d3dc87275d0abb5fd56c40493b5b2740db512c4271acfb553f5a50deb9c438d5",
  "O16#1": "68b6abcff89a1a3cddf984d1ea8a63fd038f26d4b2e28ec8b7dbc2b94dcaf76d",
  "O16#2": "c5482dc49e97baa0395aef80e91014ce3eb0a25aedcbd3031d938c51e82487f6",
  "O16#3": "49eb137bf1d4cd7a8964af90626e2c44247e56d32fde257b5658d326e060407a",
  "O17#0": "fb55d7314783bc0734782ef122dc4efeeffb409eb6b7bf4eee2691f5e4754c70",
  "O17#1": "3d110c09f4d4722f2fa2e31406eea68c1e0938a07f9a50514d523232cb9a9c8b",
  "O17#2": "12fc86f69f479ebbfdd2b9ad484c0761e67d9749c4c0db909559faec6943b089",
  "O17#3": "23cc95ec0c504ad848030cc696e44cf2e18179358ded07bf2caa676111dbe21f",
  "O17#4": "d0c8a4daa2beedab98aea7d77fe296acf2d0e2945a249591a19830473dbc62a6",
  "O17#5": "a296dd2b1acf40efa2359864c39a7d2ba56cc5cf90a5c78b28f0cb5e86305fb8",
  "O17#6": "0b931ba477fae62e54a83771360634696c2e4e360a12a1180415956bb0071799",
  "O17#7": "6559e90b5dd57405bdf180f29b509053a3d36c4abf3de535ab249b54d4327234",
  "O18#0": "394f0bccce9e94d2512a125bcc016b0d30df1e2ba70235f525e497db15b664eb",
  "O18#1": "68dac994f808ab261cf468b3ce3395b5afc8e6e13a9403563aede820c95ad060",
  "O18#2": "73514f72637b2fca32b00e2c9f63793334cb35d9202ee609fffaec5cd9eafa1f",
  "O18#3": "7b0310d442fa920a96d17f228237ecc724162445f51fef8e198e891cc4eda706",
  "O18#4": "83ff86b0c0e6f12c6ba13c7a80cba314539be74df51576f8ff51fef1a6b0cb16",
  "O19#0": "e75153c9567ffd0961f10412e14c10c81395eb78202465f38e437be205a3c2d1",
  "O19#1": "4fb7a74ded545c99246c2cf4a7f483823432b17edaba05ea7c07b364c780a041",
  "O2#0": "f72fd2157d268a916c4c14805b410a98ca4defbe98e44d0d136a4ae58f2b3865",
  "O20#0": "fffa25e39cdc556759e0addf3272f744745e1ce26ee89d278e46a48ce9e981fc",
  "O20#1": "db8278a3b86921dbb4882df316637b249c05b02c92d779331a0bd84c18cac438",
  "O20#2": "ec7bd82167dff7608da1661b04e7a03b85bf8ce9934be9b5be1aeba93f3100a0",
  "O20#3": "9ab7c3bc48bb663d78cc5370f0a81e81903b6d704e4850844784c8d0d581e911",
  "O20#4": "0aed1e046263a48faf2a85e59931c2629252879e57587ed6efcd4ef5e45ee2d0",
  "O20#5": "1bd609032dc2bee34ff1480840a9700fb2b8afa00c98133b3f192fee396e66ea",
  "O21#0": "bb5237a7d1161cdf0fdcc113eafb93cf3e44663362caf75f9d6ad3a3cbbaab09",
  "O21#1": "657b3d94eb3f206f75531e6e09e5f59bc04e598caf45a59bbc29bbc8352bb9e5",
  "O22#0": "44fe9a06b7b8aa9ca38c0c7cbc8db75e47f7db11168bbc24a67a85686827d2e0",
  "O22#1": "0584b34ef6de08aa751594a0caa8e0dbc1cfd70ba46f6c187a4ce6326d5435cf",
  "O23#0": "4bf6f3d643a29242f85a1cf7cb23182f89ebd68028123e380de05b0b4d54c222",
  "O24#0": "97be1f1295be84e803db3bca678b639be8e12a40f35dd92f5b8f472f7f124e1b",
  "O25#0": "d97d8623b8331203ed1a4e149d3cacf0079239d9793daafd4d4046a3f905f896",
  "O25#1": "6d138247779decbb1cb7b1bedd11fda150c1b6a287ca2eacf580f5531f5dd64a",
  "O26#0": "535f7b8bfd730cf85b30b539ac6008d4c91876a6723eb36d018d112a19b40107",
  "O26#1": "8d138beda550b85b53bd71282607c365383b6cf5d13a43b3d89437b800a3f018",
  "O26#10": "045c89fc46b658fced6d68f4c04159f36e95ea39f7e8e588e1ec9370429d4d1d",
  "O26#11": "e81ae7dd5160862d576e4bd70509f38630afc894888129eaaee27ab0052f639a",
  "O26#2": "7ffebb3363211ba0ea50d14553d68085d33df75472448c63df71ffa2d85b295a",
  "O26#3": "cab6993c2625b6401606044ee5452393233f2314adaff0f1f1ecf78b22db946d",
  "O26#4": "8c30d3d2739d6aa1f66c92f7c0017c82a7a091f2d5974ed76920f24e4baa24d6",
  "O26#5": "aef0f839f275d0506feb265d7fd58ba9702f4fc720f6765443e3810a0e230b57",
  "O26#6": "bef19edfbe560609cd0a7d2f657b74c2c63d5c174a6daf62561b8057cd4e9054",
  "O26#7": "c0faf1fa7e4a1490c39c2b871408c2dd3ed2196384518077467e7c48ee269630",
  "O26#8": "691840f200558a17a5edb92d44c5e69548f60f15343ee2813744b8bf26834684",
  "O26#9": "ebca0e3751d56971fb05140e2ffe72ac0cd0da79db628bef4d0c4bf31d146b46",
  "O27#0": "28242d96e88bbe840a4a395f8afb2e04705364bc50997af7b6e389cabb33b1e7",
  "O27#1": "c1ef9a529e8fb10e0b328beab9571b44958e92194fcb0ba52c2ecffbab49c96e",
  "O27#10": "39f1de01968508f43d61239c3be09befd6b55d374675b9d805f60317e9857205",
  "O27#11": "11b6a604f1534191b3df990c4ebe591e01e5ef1a6aa420535c756d882ce1df0b",
  "O27#12": "675cade1426827c7a3472e43cab9111d0e9a8e8656afa1f005878220a07c99ad",
  "O27#13": "05400c5107fe00360563c9fd09e7f757979c63a420c9fab3bcac95ee28320b5a",
  "O27#14": "06edebf0eb78b84ef09435eba32ebc4f65fa851f951853288eb48f719dcd4d8a",
  "O27#15": "466fcded44f5ea4a29f8aea1a6d74107e8a8897e314efc0b3cf32de0984dcdab",
  "O27#16": "3bbbd0df745804d8a77cd8bee95e519eb2799ec6e8a9c13a2ca12657eedd51ba",
  "O27#17": "029464bff5f96df452bf7dac7ff1fa83d2164beb00619fa6ec5f7f179b4e28ee",
  "O27#18": "084fa9ef7e55dd87e563fd726f6a3cb9462cf4324bb3e8ea6a4dca6a484b9377",
  "O27#19": "980cc09e652519645217e498b22db9ab0739ddc40f5077ba5cc7508f77a879e8",
  "O27#2": "f471e4b7b83f215326cf412dc73d0dc12b30ae6f5d0735d2d841ab792c19b72d",
  "O27#20": "02fdab8271339b49ed2fc0a21c9105be95670b1a1a592e12d428eae0eacfe32c",
  "O27#21": "8f04c2e81fafe27c928b6160a8ae7d5084a4079bba6c0f9bfe0cf067e3509f6c",
  "O27#22": "9121e086ddffb240ff977fba87cbe525af7ca081f38ce3dfaab96b86f5f256e5",
  "O27#23": "c2ba2aaee0cd96a682bc7cf84340f65202d737897dcbb4c48678266e701f8f4f",
  "O27#3": "256a7f94bf62da6582401a07d8c5dcc0ab348a00c6d6808865b1f4bf2e5bcaa8",
  "O27#4": "f173d02150021c9ade61009364443600258065e8356c63887b8456ae83e429f0",
  "O27#5": "cdfa950137666dfac643c96ef605cdfafc747d910c5a4b46df76d9a0eabbca77",
  "O27#6": "5d82b94eb563c4331634b73ee308b18b7a5b520ef5f8bdc8f89f59415490c1ce",
  "O27#7": "46b496f14b0e5161460e5b138c1730c040a13e1542e4e14ab7bc2c0da84e8b91",
  "O27#8": "2a076c552d42627350050b16306451e48ad08bf2de28ea0aba29891eaa3c910c",
  "O27#9": "a5f5da1e8b6110b20ceda73574bafe1c02a04b88e5277509b42b451c2ab120f7",
  "O28#0": "be40c33f5ecc1ab0bc1a6395168de9cfdbe2b11ef3df2c020a00613ffbfd6d70",
  "O28#1": "05fffed57cce1a902c8f859c4c9e800b69f4b216aaeaf1e643d07ba66abe6c02",
  "O28#10": "7a8b6866c69a224ca65f170a30a1f6827ef4e2b267cbaf01504d86b789a7ecbc",
  "O28#11": "c2d6b8d62c9bd1a701dce2b477f248bef7fc0fc5db4f303baac728e789ca32b0",
  "O28#12": "6fe85a8181766fff21fcf6bde13dc077ca62528d25e6302d33e7344fc39e1abe",
  "O28#13": "23d25b9fb32c74d840d0f998b6bf9cc7a359fbc556ba31714aa61786e2bfd3ad",
  "O28#14": "991d489ce3c30e9c34e067881bcd5cef529f3fa900e4da8afce98933aa20b455",
  "O28#15": "3395dda4e535ff8829a289eef882401a50ac527e8e132e3a4bb8b6d1a3a01b62",
  "O28#16": "c4df320920c0e5d74acb97eb78044182793aa14775861a6fa0ed6df920e3f963",
  "O28#17": "19634c2e7811f4b05588fa38295ae4b62c9124b9dc644c1ba64a53295747a57a",
  "O28#18": "95f5e7918093ebf7cb9e0cd1b5565901eceb336c523e7fd67f7c1f73fb45410b",
  "O28#19": "9fc5ec25336e6e5290a1175e884fb7a5c2c03b4692464093ab850dd2e8679565",
  "O28#2": "249c12f390290b5ada5c5a8996032ba31c7fb044abac1e3d754291e8d1d97800",
  "O28#20": "3d0f94f75356466fb8ae733a585b895080e07cd68cda6107dee9922106222749",
  "O28#21": "76686d6bceda0aba4a80c9e4a0462ce84fc4ad5a9c0fdcfd05d8325beb97ef43",
  "O28#22": "bb376d96d07489d22a17d2de1aec6391cd32ce0b1501c9191a0478488d6fe1c0",
  "O28#23": "fb947e603c07a266af0b3f65ba9a78a6b3c64fe3d80fb2901aa19cdade187146",
  "O28#3": "d9c90b1ae6ded31eae745a5e3f429bd899a039c048ac2729c1d1e5e518a38ec5",
  "O28#4": "923d4036976bc3967da890ec16e14a2a264b27e0ffe846a3d898086f12ab43ba",
  "O28#5": "854cba8e700f2aa08a17b978c5a6374b5dfc875933ae70dbe0b202f5c136a1ac",
  "O28#6": "12a2358b2b4693f28097116630de8a84eaa899b61fa1105019e752508424eedc",
  "O28#7": "55f76fdd061f52fcdb2a66a35b482a6d0ff1be1603a0fea1211df3a42dfbca34",
  "O28#8": "453c8c996ccf544fa2ba6772ebe358a24bb7d7d9ca807e34530e9e17de22af8c",
  "O28#9": "2494bd4ef444576a444deabd507dd4e46c80cc8c61e8bc44391052939c230d53",
  "O29#0": "0c22e76da5b68ce5355d28078115eec65469f326d62bdaad46f2dd8d9842c114",
  "O29#1": "992679eedd7614c7499eb9e6adc38263dff0230e21d8f88ff9724ee1a8e24400",
  "O29#10": "c7d1b34eaf2f7fdc0043ea8fe9445c0cc807132fb49c7427612ceae18cd0e71f",
  "O29#11": "2e75f927b2b95cd1005d72923eafced33f915bb5fd1d7221a94056f03c350c1c",
  "O29#12": "1117638fe09243ae4aa667cb13fdf208a3d0fa049022bbe2123e1ae7fad83e6d",
  "O29#13": "7943f8ff5a9f8ef66801af36ec9ea826f9c1848889a0fb4775e357cc3a7b1241",
  "O29#14": "fb0bfc4115290b075797359a8b566c88939cdc7988ad517f19b3f233278c38cd",
  "O29#15": "3f1438afb5bf99d61ec897311e20a7a5f92a213b7fc4deb52e0631a4104c6889",
  "O29#16": "ec83b08b894ebbe77da88da7032cbaa92f09e3379cdc6f9cbced0e1d7f975de9",
  "O29#17": "748470fe0f0ab5596ae4cdda588ff4a81123cbff69855f7ddeb9336005565dd7",
  "O29#18": "9bfbb4eb548f133f3ca31e732635b7de53ecad5bb8e9c807b1dde6a893e03d62",
  "O29#19": "50957ed0a5f6f58bf89010297cb09a80e799f7ac687d996313c086f029ec79f0",
  "O29#2": "e5353d9a490dc79004d19dc62bc6a472eb1e04b266546fe25b9846aa8c693ee2",
  "O29#20": "758eb5af7a49834fd04a48e478ed3e7a1d577c05297947b158121bc6b3b28f64",
  "O29#21": "e289768427fb03e16790dbde8e51e144f065d5e6dd7e7d87991d097b73da09cf",
  "O29#22": "160a31de46d3d2a91d65943318c4aeb80ce7134a16fcd69e7a7f18c76c4d5330",
  "O29#3": "455180e221ffcb7b0f80f248c2d54cdf3384f322a55067c54446731e058d3116",
  "O29#4": "ad2dad792b85b271ea603009f8dec728b7ec3bc846d116f37e8e0efb154f9f3c",
  "O29#5": "3659be95a5bfff304c004233b11f3dc5abdb1e1b27917eb41f95c8ed248b5593",
  "O29#6": "7c5cffcca79b977369bd35011b7b8702832a849f152e09a957053a86f4b205cd",
  "O29#7": "019e6399b8f828a3440c3c74c8ce622397b0649334ad7874db5e735cef2fda3d",
  "O29#8": "263ffee3d94a1f6a955da5868041e3affa95c7443db8cee3a4dfcefe3f3db2bb",
  "O29#9": "84276d41bb24aa163a0421738c2a984ea1f913d439663045f791c880a1c6bc12",
  "O3#0": "eb787f18253c54cd1075572e9489263ae9b0fcaef1b29d1cb848752ee5871da2",
  "O3#1": "e1719622d52dcc74cb7140e98879aafdc37498a3d8dcecf0bee6975d80b8a86f",
  "O3#2": "e4f29095a597658f124fdffcabf4d8feef2b0ce1d9ad0eeda852a2891c7be363",
  "O30#0": "3411e996821f367142725782a9682db940fae3ab81c982c046ff5a2a33f0dd10",
  "O30#1": "9b4a8fdc3cb799236138e84d3a60ceca83bec0cede1237ed2d5a8189939ad456",
  "O31#0": "03d22b96a02ac5b6da95469041ec39c21a4dea3a289dfcccbbb1a21a7626a37d",
  "O31#1": "582bc45a59a8b3c7e55eb833e6d839b38909736a432adf2a8c960ccec9d4104f",
  "O32#0": "0f10cf8839387d5f3c0146d46faa5081a1c97ee3497f39047a3b4a83e7758e0f",
  "O32#1": "4c199fd58806d098ade1a546bd41a6992b97de7c96e32f0712bf322b36782b6d",
  "O32#2": "abf6907d465fb9f691afdeb7ea227590b030def3412adea079af78898d2108fd",
  "O32#3": "d5e9171e427f697c0a3d6ad22a76136bb74ba8757545d69eab7b6bb1813ad203",
  "O32#4": "3873eb7ee0791b77ea91f7b19510af4b4076581e753fb4da98beeb466ec1d0ba",
  "O32#5": "3ece870759c6e9be3308725264d462e3e6f625542429b8d6fd8cb83687d516b9",
  "O32#6": "bbd72d48ae17eb576071bd564259c6c4a53ae6ed3119b405942fcceac38b3c04",
  "O33#0": "dd9e324edc6db652b43c04d9364e8838053e87e46421212dd375622a0c32f2bf",
  "O33#1": "67f0da4b73caadaf0dbe5542dc6220bb191f0df06f231e6b477fd20778155fbf",
  "O33#2": "b13cb54be74388e3f130f356ac257a3349ffc5ee3deb07810295f1ea20836c15",
  "O33#3": "da36fd5723756ba0dbc9a0edda1b3a6e9439dbe28b5098e7f63eb04fbd84f91a",
  "O33#4": "bff063e0ecf1b28b5d2c2b27779ffc9e5023a157a3ea66f0fb8e1443fb58cb65",
  "O33#5": "04d6a0a71df95d8309db1a6228f17c6e6cce236d74214ac0b1240b06d78411c9",
  "O33#6": "96f971caae01eff805f2ccf711666f4aaee14dd1eb9269de9dc486d1dcb94a25",
  "O34#0": "9c32059b7f8017771223c4a8c86ad7be67b6cf5168d8758468bfac4492ed2b65",
  "O34#1": "30e3a948465ad637d1ee69a934f67db62ab5c98f021d4c4e40db80786792be3a",
  "O34#2": "df8664ef689dd2035c588921670c9343fc190136d8ba94b5a992bb8cd572cea0",
  "O35#0": "7875d1611c4b98f6e950d3d231e7aff249e6fc5fc4425baa961d69e7907f91d8",
  "O35#1": "cfd2e7dace1a92d46d09f67752911a72b2cec2a885109693519fdfcaca73a863",
  "O35#2": "880bc131b0fc0a9be55eb6f52a7c842eddc14ce592a93092d2adfc72ddc13d12",
  "O35#3": "9548c8cc28f95ca9a41bfc3120e02b7a0777bac6a1325010e50134d0cd326195",
  "O36#0": "9884075bccf78d5c8649912e1b6361252188145afeeb52f021b38a15af3850ee",
  "O36#1": "502e44b806d9a7a07e0d9a04d110b7aa914c325829dfef48778343d11caf1aac",
  "O36#10": "84ede8860c492aff10e149588a2c94beabe6c8a9a038c9332dfa1c40407fb7ea",
  "O36#11": "8ea9b6772b6c0cfaded979b4287c40c8356631cadaed12500ddc90290b22d095",
  "O36#12": "a08e0786e41fe5358d7c00100eba72b73f127e252ef61b82e818e7e833f38518",
  "O36#13": "7bb22063c01fe9099265af7efc15a6ec70df31e3faa9fcfc0b50914e5120d233",
  "O36#14": "74c2d0fd3a32eca435ecac383d55ee4f6ef033fb5a3fe69633d8932026a43c5f",
  "O36#15": "20c9cc43a93a463f5933e5308a6cb6b02703fa584c93618343d5a1be8aca23e4",
  "O36#16": "3e5650ce66ec81874aed0744f6d1a035d9533e7ae9dfb7ab81bad67157e4816c",
  "O36#17": "32f20399fc87fb6656cff01e79bab72eb35176d1d3b04719b8cd609ab5acbb93",
  "O36#18": "fc9afc473abaa40afbaa3c978b0cd742d1f9a9878a59995c7d045d19498ee309",
  "O36#19": "266cd16c2646621a1acc73c9bd8c8cfdea59d5faacb1609506a6a040b05c1de1",
  "O36#2": "fe2f5ff774026f5e73df156e7c7f72cff49b448bd9296f3dd4de1bd8456d5ede",
  "O36#20": "0996f76044bf0915ccb00150b29621b731beacd02aa085c846d701c3c887b794",
  "O36#21": "23066981564e520a277a802eaf99fa8271ee2860792139b8a4ba88bbaaec5414",
  "O36#22": "b9b1d9243401f1aa53e5968c3fdaf1af2d78359d42cc5b3e5ac9d607335bd441",
  "O36#23": "e675547cc4beac805e7c28c9ebb02158df33be81bdb00693e648c4c335b9ab9f",
  "O36#24": "7df30280f192981ecd7b7dcb7fe51213e101d4ed7d697c32fc2d53f18275b23b",
  "O36#25": "371be9e28000d10def1926301fbbe28f43268504adfce756df09057753918757",
  "O36#3": "8f6d9052f9aa7c86f2d810feb2bfbcab84ac36d1de2f46f4d84766601b677a4d",
  "O36#4": "20a84f7e7ba879f85ab5728e68598a5e14e993b49e45fc613f86ef43c8ad6770",
  "O36#5": "0dec91c8ab0f62c53fd872e248b1ec54dd6e68716490c462d613d227e844eaa7",
  "O36#6": "7bc09f1dba223305fb5fc496d1659d1ceda16b09a8b792e9c31dd0d694e5434b",
  "O36#7": "558ea078e2619e101c7f1b08ee6ccb372bfebb1c57ba5df0fbaca009d43d889c",
  "O36#8": "e10a1b31e3574392e90bd798bbcd35339b71888ab9d289a7199c428dce6ff0e8",
  "O36#9": "e15bffea0a7a759d273d6ae402efe6edc45fa68abf799dca281f5f0510596761",
  "O37#0": "96a323e5d5124b28498d02d7527a7479318361001283ad2864bcc573662e6d16",
  "O37#1": "d3d3db5752d77fd7bec4eb478e6ba6b1fec633dffbcd71b2de663ff0c4aa8531",
  "O37#10": "054c11dc76b09e0295974916ebc600fc7aff38cd87dd04bf178d34acc0c7c747",
  "O37#11": "a0e65e2c53e2fe0bacd9f82c60e8e2f44fdab39231167d40fc14fc9577d5d1da",
  "O37#12": "bb6d0407d9b2d13c2a8724b046a0d77fff84e0bee67515ff975beb8d7eec6f29",
  "O37#13": "3df653e59f56625e365f7639962ecead672b846d3fce97171bc078f48c7c1eb1",
  "O37#14": "1b1701b991fa1c7054b4be858b721c9ea0e3f60776174337d45802b54068a7c5",
  "O37#15": "8a2586bc7e114430b555536beffee7d98973ff7a0714c56c40c467367a414b38",
  "O37#16": "125cbc4b8d4991edc3666e0eae202fdec3be2044e3de8dccd0743535282e97be",
  "O37#17": "37c7e34ab9260e1dd2f8951dcf8e46996cd552ba7e1baaadce89e9162803c4e6",
  "O37#18": "7349ccd164fa529e8b9799617bfd5cde0f51480764d741b93575c01db3a40ddd",
  "O37#19": "03fa79436ccfb95e0206e3055e0daddb75df393a545233112ec0292ef63a5e02",
  "O37#2": "49bf4b325696f001cff6ab8b43e362264fba7e651948ff6d8755c003f6278335",
  "O37#20": "7bc20d3ee8bddc322dca3e42c67aafaac5495ebca77cfec63e29d3f9ee76c09f",
  "O37#21": "b346c3fc7da3f4983d3a21d5c9b737ff99a9ad7b17b1a42049a3cd421d184a11",
  "O37#22": "6f760c495fd076ac64c3925f69390eb5b51ea7bb69ccb095af859c4b922e69d5",
  "O37#23": "055d838e7369f7ba2c3f314f5780616ac64ce822f6443000636373627ace8c51",
  "O37#24": "b6f529f92a9b74258e92c7678826542a2ac275a2d42d6610ceb9011a1695c268",
  "O37#25": "d2f5f4f3152de160d675032a95f20ccaa5bc9ee9b2845b608301d013306f530b",
  "O37#3": "f43d3d761d68d6271c7144be7ed30d47d49bad8890c05f13572e8c496b2b5374",
  "O37#4": "17924cd3ed15982b7a626f1d4775639b51d5c3a2c4555577e4f3de1125622606",
  "O37#5": "765850c327fdaec7af8098e8a6046bb0ff6098c4e6b0b6f81b34f97a9c7e5a1a",
  "O37#6": "149166065f7b2d581ccbad13908b571f45396dd07efb16374ca92e0c1cd52afe",
  "O37#7": "dd5122d99b3c181c545cac4861e1bd5e033e50b4fcfff7cbb0b161f080b9fff7",
  "O37#8": "c3315b55c095453b42617bdb7b55592a43584fd62663e321b7a18e8ed0b4dde1",
  "O37#9": "138ddac981c48b7d6b147125465e5bd6646219c5f7fe729ade3b5a062f1dbe3e",
  "O38#0": "7251d6cb417c68f26d2e138f246331731ef3244b0ec8b9b25b90d3ce3f3336c5",
  "O38#1": "220067a7dbec951dc9d280d320ab920ed9452b85860612d5534b4d536ffaa289",
  "O38#2": "2141f68c0d08e4f20f3b43dfac6aabc7055e8c04da5e6531064573a24d894fd1",
  "O38#3": "3655a1d691939b40e89941e25767fccb3664a72a97d29101cd766f279c77b109",
  "O38#4": "bf1d106ee427acb655a9ae9ee9437875a8a49305f3f63e9f34babe1b3031b86e",
  "O38#5": "b0e9e7d555ad96f56bbd8e7e762b5cf245429879ae17c96c95d3bac9e8655fd2",
  "O39#0": "9b145db8110536d8a41382ea8a9248e2a8ca96f001b70236c171e72e89fe26c5",
  "O39#1": "a490b8a0e366d70971b68e6a3f6355de5b62aaf5dcdbf64c774548da3f33142e",
  "O39#2": "b66f5673151065320b9a9a9f37deb76aad11426fc0b44adec719a00864809f2d",
  "O39#3": "b84d801bff9f1feea3dda35780f04736061d48c27c725884762e2816a70b25b0",
  "O39#4": "831a34b2e06b585b7fdb1c58c7f65f6c5a285be72de922346de5528f50caee9f",
  "O39#5": "51c2fcbdbbddf93974ec9a30df3df8e295c5ae7e195dd59915e8fee4650ee386",
  "O39#6": "b5b24c8138430fcec97ca3d65e424db52a97cfa31e2b7346d907730f3195da71",
  "O4#0": "5b5ad71cbe482ff312a14e1aad6cb1d4fd3a3b773e7f9696aa98f74d862ea160",
  "O4#1": "55b6193ad9a8ca686f6c9a0ec4591294fe5f6c1975d145ba496c8de3402876f1",
  "O4#2": "53aee2ca762b9729196afeefd22bd5abdcbdf87a0f29cc0dd2f6902a22e73e4f",
  "O40#0": "81af89de91cb99c561016593af4d37f8454877a802ccc6134368777d404cc706",
  "O40#1": "ed69969d0d097cff32da11a11944176be93ef8a0e97d293d4fd23ddfe35c869d",
  "O40#10": "9b761ba642a4cc605c756d6924265c4a9208963c8dae2bcaa26a6022096e4887",
  "O40#11": "0765f5c47e763084db8c43f4c825da589e84703a74005b7a5331c8cea442dfb1",
  "O40#12": "229c69eb5c859a3acf59581c18b52213b0495cb7fb3fdc0624b1bcd511d159c5",
  "O40#13": "9dcc34d03238a6cadfa82308964943442e183714704adb6e57089750e55a4ef3",
  "O40#14": "0b26236ec054a5e6cf841e3e5ea07096ba82b6fbef5b200366c838a41fdcb626",
  "O40#15": "0d36ad9cc96301147055dd6a480c028fae33d19ec711508b57ee47cb8c1365fa",
  "O40#16": "51bced3abfbd672237f8dfe54e5f7afbf57aa5bc1b49ade0d19b926a2c28d8a5",
  "O40#17": "5a39da6d4be1dee35cad2cf511eb8268217a18b1477af1b489819aa3dc6fdb01",
  "O40#18": "02aabaa37a1dcdd24b2887d62b612c0738e8a0117e7e7ba308d77606f2a50f47",
  "O40#19": "d669e3d7e02bf28ea70e82a61a236bdf35ec40b4949c9cb601805584ac2b853c",
  "O40#2": "14e7f9ffcbd5a6afe63978092e49e859fea2adc9fbca82e952a8bcb2771b6437",
  "O40#3": "036e16919b70a3f245c3d29aa56cb855c5283483c676c286ea45431d92320ff1",
  "O40#4": "17a5291d20b47881635cf9f625f756ad30b03a28b61f892c10cc6e8516d32112",
  "O40#5": "49af7e93c42f0ff261f7a2555203fc8141cedf82f446bd94c4645cb3a4cd1286",
  "O40#6": "6753558bd24d69484202f5ed292d33c1ca9b6761d09a54866be4032432738423",
  "O40#7": "d6f54fc0a23af5aeb7be58e38d43412a05c245b7db4d7c14f6ace5893f06aec2",
  "O40#8": "1318f3e7530752a83df614a1f1fe12a376da9ef912174096bffdeb645849e74b",
  "O40#9": "d153a3caf0bf46c8c02e88e1e4c5d649069c125a8fcdc3d5595ae7c28dcb4e24",
  "O41#0": "5630bb2baf2b4c213e1cb7768ce7c93ec813467c5954ecc32b2e6c9ae5f419ff",
  "O41#1": "9f0459bb68e61b50c0d75da6d1b99754c9ec30bc593dd6b7c2e30bffa2fcdf0c",
  "O41#2": "87cffc32ed781a4ea5bf6929191b0b9e72d635f3cdcf63b84e14732260d41863",
  "O41#3": "1e9139e2d578ae1d72299392f57367f1a8e5fdc42cbbc34591fd79add3213dbd",
  "O41#4": "1a0642ecc8fe235262a72df00bde5bec7bc968a338820ad3e09661abc1c66870",
  "O42#0": "282cea765fabecb99f1af519119b57f83fa02b757bb4228225746d23b7961397",
  "O42#1": "91f63204aa7a64bb90560cd4f1ea7a42f9c7b12fe1b5bc6ec968b70ee3dfc5c5",
  "O42#10": "dd6268a8ccae1f276b14c9e272e9a99eaae53ebd6d3bff6061e5b2dd39b5876b",
  "O42#11": "1d6f25db4dd5e8d816acfbd40495ee0b849ffdd86fbdf0f537d64aa4b950e6aa",
  "O42#12": "e3adcc73f8376d50ab17c6585ad356c1443dc5a0cfbc7e2be16d6f77e44f2522",
  "O42#13": "f84d546df0eb543b814bbcbace0531ccf2e821ef7b292a82be58226b2e58788d",
  "O42#14": "6dadfd0da21b507215eb675df5ba969e9ec4e73fd377f6e19940e1dd43a3607f",
  "O42#15": "d4c09a8bce2df14eea3b2e950d82dca6252ca6e535c0e07f56a4ca44789940bd",
  "O42#16": "76f1ca11e9a5c18e94e074b0942f8e07126611b5e2e85429cd3abc7ab4a93576",
  "O42#17": "143a28338f29471ac31a433977f48ff0782166cdb9c32452df4704f46325043f",
  "O42#18": "165002ab6fc3e4830d85a18e469e7f89e0118740d29b988626d5e470dccbc1d3",
  "O42#19": "c8d19beb688c897ddb2ccb931b0ce6467d2da231acc80d966c294d91ecf256c7",
  "O42#2": "15f8e531db4e9f1e0327bf44ace3fdefeae911b80238c40c4a7956860646e050",
  "O42#20": "96f4e0e6457dadfde61d129f3c544e51414c7d201cc343d5e32b14131d6b854b",
  "O42#21": "901392878593f4a89b40e01bb17f13ed597da6ad66dd18ef3140a46c90e41add",
  "O42#22": "100054414d25cc66a6b052212d7e5a06e5b724e7cc05b60f141a22ff1a20ae93",
  "O42#3": "53757e8fdfb168511a6c41b17d673cd7d0be59656fb19553bd161bf333b0296e",
  "O42#4": "54d6ad5022e59476c09460b8a8952e293da2a8724226ec6f5e192f8b27bcfb0c",
  "O42#5": "350a4642a382cb9c8eb8b4433025a3a2cd1c429c8291cd291f7aff6765d43089",
  "O42#6": "b383fa22d77bd689a0b64e6f77868aca5b490e0febe55c746d294ed7f31ff594",
  "O42#7": "32c4e6deff432cb634abe4f966baae3f46bcc625e510c1ccb252e1b77db47226",
  "O42#8": "c8301cbf2632972e03a374dc4a0cf449c02d44d7f5dee5dde57d462a0e98f53f",
  "O42#9": "8dd15d8b7dd69d1245b5db6016048bcc13aa04a01edd1fdab58623ce64837bb4",
  "O43#0": "2632358375e0d6ccc52cc79a96b337e4ecf47bfd4a4680fc0d23ce512526b1e7",
  "O43#1": "9ab5c2bb8a88fd854a405b8ff318db76d71db7c47ec643f70765be9a4de2d9cf",
  "O43#2": "2d2d0b7f0cc9e8bbd3ad5bd88199b7034e04415e51adf987abaadba40afc3e76",
  "O43#3": "4f57fbc2201de57cd7dcfa617e71c96d9349772b3c3f2f92f2c834bdf015ba4a",
  "O43#4": "83b60f3e8a4d44614324938e9653d1fd4dd7063d9ca12de05cf809385e21d35e",
  "O43#5": "102a264cd4fc409deeb738ee838dc8bc1500bd5be37ae47c3cc2eb349245fcb3",
  "O43#6": "b449b2b42fd3d69fbb3305c55b884334ae71174e55e2f02417e3d999db404841",
  "O43#7": "6cf5b3a48246ebf5f56d071fb4b86212012acfea2378cbcecdb0faed367a04a6",
  "O44#0": "3d8be4ec3ccfda8d9fecab19d21f68161c310c10d1e35c2aa03c0b2333d5a1a5",
  "O44#1": "a5105170a3beacf1b0cca0e8fc68474ad761c289d40011b20eb73bdf8149a039",
  "O44#2": "b4c95f33bed916190412284d80a432292276e47af045caae400380245a08c22c",
  "O44#3": "dc158a880ba4d2e7978aa8fd468d53b18e559c636d971cdf80fc915ffc860db4",
  "O45#0": "c07dd189a104535423950a7edb41d0dd409f68d10e7e17053d15e04bac967b0a",
  "O45#1": "0b752ba06a0f0366079dacab3bed8b3a305a1616f30574421cea35bc3712757a",
  "O45#2": "68053f6924dbd5b690516be36ab92ff20de1a58eb661e99565586fbd186a7e95",
  "O45#3": "51764ac00c28971c5f45611efab0436f92a6bef1ced13524c0c248b6d2c2af4a",
  "O45#4": "89b06b98748df5f5ebb936c4421e4663eaa97fd89336b5cab5a30d00b6cfb8a8",
  "O46#0": "ea10932da1218e0cb526ccaa2cad4721d71f738d6821d518e38419fdf5df7c04",
  "O46#1": "6a2c39f1ac24828415831d14dad2e84ccdfb4ec124ef449d7fef4396608cf9fa",
  "O46#10": "8e748f20043e698dafff36da3b8646eaa35a2759449c87d385ee0995ea3861a6",
  "O46#11": "1e744dc566799f92ac097a008ecac9824a4c5b0f5614eb96ae8b8ec80ef781b3",
  "O46#12": "f10d081cdd39ccdd6e4fba753fbb10287e0009d8abd6618901c87f934ec2db6e",
  "O46#13": "886ee1463d60366a6190393263446b2ceb05b07ce80d1b9c4f4ba2babee82215",
  "O46#14": "cb2ea6943f2e70291f96fb55b0027a630a23ac5408bfc2dbc69b3bed993a567a",
  "O46#15": "f03394fa4b1999bfc7e0cec6deadfdbbd8ca012f3e62217d88e883711e4cea2e",
  "O46#16": "48d1c07c083ff90761d13275710381193da41d6dc7d02aa2c806e40c49b1cdf5",
  "O46#17": "963a68d0f90629c1fddabea472b87d69b6df65f31209e430bcdfe053053c4ca5",
  "O46#18": "3f07c3c1491e2523a73dcd8c4d92b2b0a9e3835b6f8b353bebcb40f518d1e82a",
  "O46#19": "7a78f5eb29de8b7a659b74c12887b28bbbcd8c17b13cd5c826b3fa46aa72f67f",
  "O46#2": "3c0defc387665474fe7009e8fd931230a8000e08760c97ec04159d148f231057",
  "O46#20": "55de383cf2fd7c8359b5612bc27838f8f619d3cd55161b159fffcdc69854e572",
  "O46#21": "1a22145aa69d590aa2c3e3d0a0f215b6c926d1717f4ec3ea685d03c4b284b189",
  "O46#22": "0b8033b72421d1dc73fcfe976224df76e0888ca50e608bc8c348c1445763e286",
  "O46#23": "e68c7d7074ae97ed54ea26adde42f74e1cf068fa6c6f5934d15b1e0b63add5ae",
  "O46#24": "6b44aba974a5fe195f510eb32bb549c8a704b56ed701dff56f6179b64f6ad4ea",
  "O46#3": "ec764e78d8cdf7071707e3f45bdb6d2c601960dfb63dc5c854f7e533d3bcf488",
  "O46#4": "c8829453801e63fe5ff926b3131d9f634f49f4203df4562ecce6fd0395f426c1",
  "O46#5": "604e70f3cbc8b14d28db447841209d5c0a2015f142f19737840c66b515eac133",
  "O46#6": "cbad46ac93a196beb595fcbcdf27821f674f172cf81e16c4ef69ba7711b02744",
  "O46#7": "0d4032727f59a6783e069a3bd582fd19545546465cc60505843905d7391e446f",
  "O46#8": "683da5cd84bf245e4fd2b6a86f28bee86952ddcdf78993714248cf139371955d",
  "O46#9": "d62840cd87458084de34a41c8327b345d9d989b279ef3fd2804b4609e6fbae13",
  "O47#0": "ba23ae1ecddd7c54ded1526ce483230efd53f9732b1b189301310ad9183fce75",
  "O47#1": "48444e1e4cfda699cb5e3c54cc6c9a50e326192f5130edcc73f7c3f6d4e340a5",
  "O47#10": "5eedac349aa55228a20d92eaf527cbf9ce0c3fb0d0e85d9a5d2b4f84faaeac59",
  "O47#11": "a2f0ef73f22b0f67b550e4adbc443364542ff7a9420abee1c71de81c1135160c",
  "O47#12": "9bdc0da11c6930e18d86ab85d9257925bff6aaf95678f8f1aafcea22d69518fa",
  "O47#13": "e198fc6f9146d423205f6f19ad052a6f4dfea171488ca122047e5868433cd6ff",
  "O47#14": "ec08fd5f2798ed30ad390b27d03a838e2f7bf6cbc7a83d419e5210de8d486aaf",
  "O47#15": "3affaf4894e04763482970dbe135b172d2fcdb0f93fad2540f192142bd9de056",
  "O47#16": "78f3ddb22953963cf295c4edc3bf864af0870e7ba19e55e7ae80f9e9baed1d67",
  "O47#17": "631d8d74b6eab62b45bdd90f73a7267169d269ea62b34235bd182f2f58609dca",
  "O47#18": "cfc205f8807ba34a60231d6293b50e860f3e60d8f13c1181f3790d80e6819d7d",
  "O47#19": "54adcfc82e8d77f7c7a65ed4ea173cf1154353a72e0e5bda42f6cb402357289e",
  "O47#2": "cc452e0cdd9b83c2bf5723e3397ed4b0694372cbdfcfc5a89811d87d2f4eba55",
  "O47#20": "51e40b0515e55121be25ecc394f79237bd4c3d98c55d3292219267762a68e754",
  "O47#21": "95bf5730fc303d49e20da93c7e6c399011d7c805238dde62fe935b3dd3a220fb",
  "O47#22": "85ccd3e75916a4f0c89778a2fb792ff50ff37990d48f26b9d3f1fa3de5b76f70",
  "O47#23": "b9214918e286c78d084c8d8fc367a28155a6b691a94956c7c58f4cd7334e5e8c",
  "O47#24": "19e815cbf8f9e20948e34cd791ddfecb2ba89fb25c9319e7fccd8790e83ea306",
  "O47#3": "0b5c561d144f7696b8c73061cc1a0b6d5fb347553a6953b6db0c11b8f8c65868",
  "O47#4": "5ac515a8d53b196e8ccc0a6be4b50bfdcfce1906787e2f3b6b24212cb1b5658a",
  "O47#5": "68d5aef8323ae19ab4f040eaa523c2e4ec46e9b6b7426a458ec79fd0ff3b4036",
  "O47#6": "4f7e83f7c966571ba6ba5a58171193d203000488f04e2ab957068544ffc49e31",
  "O47#7": "6c1b0e1ef30c73ea882e1847dd28c40b1e25b4298e9d3c58e6caae33729903d1",
  "O47#8": "6b6085566fbd08e8278b5819a91f031b85b673996da1a89ffd380bebeac6fc3c",
  "O47#9": "dd2feb032ddacd468cb354350b080367a4989546e1e35071057f306fe4dcbd05",
  "O48#0": "a8d92499959d6110dcd824231b051580b27fc92a36f86b5381822905989b5eda",
  "O48#1": "6608123f8ae8deaa3656b74ab893d78480680fafb7ff0228296d4b4a96335ac0",
  "O48#10": "fe5ef961eb4db942e63692c551427c282f701f94633ae4a8aa989de0688ad479",
  "O48#11": "fc10a57630fc40667e424216afe3dfd34dcf7b52d70167e25485f9bbde666cb7",
  "O48#12": "187ad10d71500db8d7c4e7c1fcb9b2bb1004ff082b427d8d4ebb7da21818c1d3",
  "O48#13": "768f34be503f32a6ec8a773fef330664c043d751e03bcb6029baa2cf73670faf",
  "O48#2": "838abe17b0dd2713a8fd21b2cee83d620c742fdeb0ed26cbc954ee55ad204d4b",
  "O48#3": "6cba5274de604dc689e1015a818e72e18e92543fce181fae87be3a403d3c9ff9",
  "O48#4": "eac7a0980f2c735e0cd633b561ec2e3f269362adb3b9cc1da7b30571ef9d1379",
  "O48#5": "472ed96fc5a6f979a9b0285f8e813c6d40b5441ff6e0aacd555cbdfe37b820a1",
  "O48#6": "3d8da891897af41fe212510e1f0a2b3aef98755f3d20edbf64d5298711d9d35e",
  "O48#7": "bb843b72f936de6a8166748fcf69d7230290ec83c7869277e904d2f2edfb1748",
  "O48#8": "e485eb51dd2e092682a1fc44b8cc64463888a55b57e1b7c219aa3f4f1c07ae14",
  "O48#9": "13f8073b9daa6368960e7ec2701111b446d59b185aabce4268db572ada9bb9fc",
  "O49#0": "7ed5654a1b6c6dbb500364b7386b63887144077ba49c6a7b778c04e8e29d3cf8",
  "O49#1": "7f0faf5277c1d73907f18c9bea6fe308e3cd689e57006963fbcdc71418c7ce91",
  "O49#2": "812fdd437598f7f7a8ab3d79b1992f2f87d54d5691382aa4bf502376c65d9d3f",
  "O49#3": "4419d27c620cbdae8fbe69e911c1c8470b3005c08ce5d3015fd040fa4705cb3a",
  "O49#4": "8b9222de267ccdd0a28bbfbc5ce81c0712dd9e9bf9255c39a4e5ecf9ad2738c3",
  "O49#5": "ffb1c489bb2af180ab4e1bbca1dc71d2514fa18c2250be59cad37d331a7c6fcd",
  "O49#6": "d1ddffd237afd398101d8aba96204e3098775878b178454ac0b7ba4052862580",
  "O49#7": "d0f3a67a5d61ea1219c53a5f151df24972f281d0a7b870291a5922fca4d87894",
  "O49#8": "77dca1d6b1dd2d209d92a947237a32f3101b08b098a7c5e59755916bbcd127b5",
  "O5#0": "986c0dc956dc822b5d8f698661b9eb1ef880786ff9043c16744d2a420e99e9bb",
  "O5#1": "19659717825e8ec838617f0b1f2de537146d39740e64277f3444d09a3ab285ca",
  "O50#0": "aebfd9b4beb7050e942ed1df3d55afb6dfbd665b7d460b3298dbfa2d9a3ea409",
  "O50#1": "7eca5cdbc8c7b6e56ead9b5ac4439e1964d03791a09235e191c6dab602fd5f80",
  "O50#10": "402c6ee91a2cd30668d6cf8863c79e3132f33e75cb1f7390bac916213f4984dd",
  "O50#11": "c599d4828d981a39d3325e5eabd8d6809ace3fc1287d1c3e79c2bf72b5b5dd43",
  "O50#12": "86561c18278b0b18c3590ab453976a2a7cd438a0e4d023bb037e4159a8ca4dfe",
  "O50#13": "21b7b9ad05e3f09b2ba80f8238a3bbe99483084e800317ab272701b6129bb839",
  "O50#14": "a61fceb2dfdad04ad84a63b1c738fc79ffc5e9dff4a6eba38ecd5dfb8f608d55",
  "O50#15": "f2a3e2f403ce5ce201b1c3aadd66fc800b0fb684607688be735199e75b567e63",
  "O50#16": "0dc10804ff763cda8332e4f33338c3f2cc685b389bb18f4115669597abaa2976",
  "O50#17": "155a4e8fb305b3349d63e744e7d0ed496aad090eab010785cc28dc2c1debabf2",
  "O50#2": "92e7a9e7eaa6becfca0cf362ee5f93e7510ba9da55165ceef25ba164df05e803",
  "O50#3": "7b6537d4fed1e76b6aa53493e53c22fcde179780f457b059b2ddd4a2b8689cb1",
  "O50#4": "faf3ab9e65b3aa0be29fc6c2793a28941148f3498c0b737bd032473b6e980285",
  "O50#5": "c472f5a6b6f73ad6ed21c94f9c47eb2cc15fa17bb2ed3f928dbb88b5555dd6bf",
  "O50#6": "9a605ca58823dd2d818303e8638dafbf85897a1173b69c56ccf83e0b06e59727",
  "O50#7": "ef5e4083389256818b6d5029874d3980c54adaa47210e0a3dfb4c36a45e9501e",
  "O50#8": "dcd07e852e24a203db45e10fd0b3b57f009c737932ed0270310eb566ba966eb1",
  "O50#9": "4eb75621eabced202fc1704b9052c6588335b92a48d2371715fc925cb8f45e01",
  "O51#0": "34dedc607cba3a4bbeaf58ab8da70c8b2479f01a33a432b5bf24570d6dae9f4f",
  "O51#1": "3f433750f230dd644c813a9bcb4507757964612e8d1cb7674408be165cdcd676",
  "O51#2": "a9d5dff78c94e43c3b289ad83d03595646d7c7f8dc38f96cd5f76f210058074a",
  "O52#0": "577745f539b4283f1a4c9e4ea182a527eb443ccc70fe065efea866a500f24c92",
  "O52#1": "458ab8fe370c94a15d4ed6f1271ec1a7b5edb5121cd9c9e8d049bf62e50e2b1e",
  "O52#2": "9c248f1c16295dfdd0d6d6975c0ad480344019e795f81ad8cf47653a43aa471d",
  "O52#3": "d64e6a89ee39427b1c21e2aed67f6259b34a2d4048b6355d886fdf14f6ded24d",
  "O52#4": "e738661663c7199292d47dd949759ba775febc1b2761e881123b2902a9e4802c",
  "O52#5": "5cbaae69d38cb1c530f2c83f0a00217e25aa0b2d0a477353930d3226f4a0a7c2",
  "O53#0": "53b9d07fec45c92416148f4bed6ac9c67ad6ea669375166300b5d470666a8c12",
  "O53#1": "9302e7dd60eaf4a4c80964cf4edfe182bf1a39d8266c28169034f9280cc7a68a",
  "O53#2": "40674ebdc058a852e9b80e7a31891fb101eaba6ec163dd6cfd46c2f71108d7f5",
  "O53#3": "742ca5a5d70a28d6b6936230634a7aee7ab58edd1666fe9fe177b0d41deed93a",
  "O53#4": "c3c97619b9b52acc0c1ccdd9defb2be7b1dad4a6455b5549862a7bb890c71303",
  "O53#5": "2b59f82057351a9c8154e3e726d93fef6f34fe8628c286e6b6597aaf990b5bf4",
  "O53#6": "eee6f6e422fbca76c9aac965599e8450650f1c9ab67236b8ff4d0f6d9907b42e",
  "O53#7": "2a259e16922f6859d789fc9b9153d9721706c065712b74146ee7103f8822d5bb",
  "O54#0": "b2b243aa56e712f39e118383202ef992a592f344a106a7f0389351d61b677d20",
  "O54#1": "0a3a5b6867e108051904cbc5096c80d8d12c1ffb9cf846617c6b7190a6fe7416",
  "O54#2": "a3026bd735d8343e4ee59df3e985cbf2c19334dfef38346dd7ec6537fca2b9bd",
  "O54#3": "29f6cc4073c030c5013d782cddd28430ab42a5eb00169a2968bea78bd7f34347",
  "O54#4": "d26784dfba9ed737d90af470633348c66a3ceaebd8bb15913a84ae2890d8d806",
  "O54#5": "a786c34c696ace25ba03064b8109ed5242a2eac6c6e39f40136060dbcb381612",
  "O54#6": "3b1a74ce315d54248fc9c7bbd1182317d5530ab1bd369ed9852a298cfee35c45",
  "O54#7": "562bb47c0a6d055675c131c0533417ed4b4890aa6c9db34b28bbbd610adaa6c7",
  "O54#8": "bf9d202e56c4a1ef7187dbc7e7ce8d32533afed464775034c3ed33ad60d783e5",
  "O55#0": "3158b317234a43d613075085399a42d4666b5595f2b67828797399e7001c7f92",
  "O55#1": "37ece94cd179f7bf0c5fa785b8bc992788bfcb0d2d1e996ddeb532f4b335aa80",
  "O55#2": "fc023a32eb69a8291cae56adc86f0f5bbe23a629434bb60b78b5e2a8b22f565c",
  "O55#3": "c4a815bdc918d0bbe7b485681f22b5c2ab79991ceb4c45364d7ee8375cb2a9e6",
  "O55#4": "e4fae1f14add43c730abbb6e05881f034871c9fa6547fb4d3f88ed7ac296b4c5",
  "O55#5": "e09b6129bc3bcfa3e6ce787c241989986a5503caa5102c1fa3d123e0d54b3f45",
  "O55#6": "451d5abe1f7a409b987d57f3c2754141663fc98b4123326b6de3cc716da2416b",
  "O56#0": "f4ddb559fe6f8170fca02823153da8cb6232b490393447ac30ea9f062f9f78bd",
  "O56#1": "7b14c158ea385b2980f0ed0b0892d44c30473cac34b3788cae9984a8205baa04",
  "O56#2": "a2e956cef19de4b16838e4c628b80389758d7cf71650379c60f029e518e111d0",
  "O56#3": "2759b26bfc623d9b7da1523148b9ab4cd7c990640ce9f17c0ba0687e8a1c3379",
  "O56#4": "08fee20c962a4f5f46cf9b8cff01f2d4fed9512c1480beb0b12c37d967932e77",
  "O56#5": "4fe3a381119157c4ebcb4199b184e37a2de435a329f8d7884ecec995ddf219ea",
  "O56#6": "084787eb9b711c5145a0d99ff94c6661f644554a120483dd0b1d120f973586b4",
  "O57#0": "8b1ca32a7ce94ed79bbd4ec889b08f1be6cb993b1ca64e15e48f033ec98eca45",
  "O57#1": "aa5a4014834d40bb2f6d01001cb992562d6a64f52ad357b11abb9136576cb290",
  "O57#2": "b9b0d8242754dccc334c926fff6d92b3a48e8fd27feda36d0a81f78fa43ceb1d",
  "O57#3": "0d26056bc975df5db5750681da431120048225cd3c663d96bb2ce2ad4cd12e96",
  "O57#4": "001fef32b05aaa98b1557dc24fb3f9f543155c03268e29af02702a4f604ea79c",
  "O57#5": "1308209f50f05fcb48af49d4cc8464d96e0936350a5aa2cb9428474cc78a3cce",
  "O57#6": "e59900055d0b0d6ce9bb28506ed89f183e7912dc44e3bcda7472c696a76a2809",
  "O57#7": "69733ab1f60ed2bdd8acb5a7a6464b6813fef2bdb8c868bee18167a078c27dd2",
  "O57#8": "3835447300ed8be73b1692406a7446b8ed9af60975109070f4a87920d9b05d35",
  "O58#0": "173d73e47142376f2743bb102720fc301b8ba3e980e3923c829cf6849da20791",
  "O58#1": "c99c5bdc5c308a199184451834c2063a5ac7d43f179b56362c657b76465b0119",
  "O58#2": "efd246ca2986a4bf2c89d85c15a0ad684a322ab90dad831ad97113723f02f530",
  "O59#0": "75649179efd090a7456520a331f7cb02a026b945e76c959297b25b2752b9866e",
  "O59#1": "294bc72e58a47a57ff5c5cb649e28573a63aae8e63327fba3e73cf84c48154c0",
  "O59#2": "fb5a03201e2823cda9ded3a1e047e17a39652264ab8c363335a3f21848ca66cb",
  "O59#3": "351eff2b4b87c7df593bbed20e88048d6f8b256b023a3be7770c95092b29a026",
  "O59#4": "50ad29fb0124d2d099e40d36432da46337862f49a4986d58675080b937ac815a",
  "O59#5": "7976a82d75ef67479f83879825ab2982e5819b2f791d0931d27175bb962b1a3c",
  "O6#0": "0ce4b3b9c3836e85428fff66f20d5e0ce00c169ad5f202fdecb681a4f4866bef",
  "O6#1": "2690f3ddd657399030b80fd14c67c4d647118f358448b5fff94047ee64e82369",
  "O60#0": "8b0a88b9ef409c63dfe3c100f3896b5adbb9718a99f031c05cead5bc04a38b91",
  "O60#1": "cad8ab82c049787f77ae30ec8755b1a3d0a44c014ba69106d6f6e7d067359761",
  "O60#2": "dc1079f0ef7114ff445410af177de7881d2aa2780553298606502dc9cb065f34",
  "O60#3": "b5b9125702d263c54d80bb833a9ec0502289e9fe2a46b3775027452bca0d0355",
  "O60#4": "2fe4d44bcf682762035586b62bf39a0bf208c2c06a45dcd7cf526366be87b351",
  "O60#5": "b84ac920accfc08f48d4d06ff0b580a585f01c685422316eeb7749e59dcb1cac",
  "O60#6": "ffd969054e9cb471b8754ee34a149df16cff2187032e37e5aa92825fd93de8c4",
  "O61#0": "ed93ab6ed7bd565592b920e9adc7b5f78fd3e236663655dab2b15885b8da49b4",
  "O61#1": "e7e38b5403b504964c536d903187ef3fdfea5e8869cffa50b338c8bcbcc09cb7",
  "O61#2": "582fe2fb4be7408e2d6a2b0bd02ca34713b70428ca981981951a031134bb2000",
  "O61#3": "a41a88822f6cd910dca260a8308923fdba726cd99b1da7acdcb8f11f44291a46",
  "O62#0": "38269fd9b783b94bca4491cc9401f8d292b984db335f0b85773255e7ca67f36a",
  "O62#1": "841c8cf24f2d6e2306aeda6631ced62ebc7f2029dfe7193861a983afc17ff902",
  "O62#2": "250578da512ce1c7e0e8225b292d24d55cbfc7d28cf8cf46795c0249f5338d99",
  "O62#3": "fcd3c618d7dcd12a55b60883e3d2340e8e7326651c23078ba06260610ae4febf",
  "O62#4": "7950ddf8f20da79df580458165c4a5703b7bd57b18df526675434a74d5f296ce",
  "O62#5": "b8e2ea2ba541875b58605af632d97b2886613562cfa6087d5641a235cb0a6018",
  "O62#6": "dce69193e0d65c9be08039fdfa9722858951bde7b114610f61b5bf0d72024f7a",
  "O62#7": "99909fbeedef29dfa6272e9c24be04ea185c2d48527351e12b46136d34e19773",
  "O63#0": "fe75c77b0732c3d38ba84af0b56cafce76f158562e269b2826024e0f111f7093",
  "O63#1": "845acbb299a48371d5f6a8433834bacc4dd487997ccb171ba6b1cfd163b4f46a",
  "O63#2": "0ff7753435a0eb85debc4415f4834687456e12ea98d7e970dff4e9416e3f88d5",
  "O63#3": "9610194660e793c56526e586dbbd057cf4f38ebc928bc067e0162797be6eb8a6",
  "O63#4": "9e436397743c8c4faa641f935929261f07bcc3c0c2ef70bd220e51b47423d56d",
  "O63#5": "61b904a10ff968fcbb6aca86a98126d128f5ae0518c8f7f5588975fb4ec3f465",
  "O63#6": "2b6510bee266f07c9757d72a2948ba96e1eb0dc49002f66090a3d17e4b5296f8",
  "O63#7": "d2a0f97f1a81cfda8d8f38f89d3696e22c19d23c7b7d858f11ba22c276aa5cd0",
  "O64#0": "27add46501838a517f7fcf8005e21da3220dbefa3d76c34ee04c9924c35a1f7f",
  "O64#1": "6ff841548372f12eb7d3c62071fb6bdada5403254170bf8c0fadee0b32a056d5",
  "O64#2": "af42de0db78bee7dc459c22ac563ec9ecd5912baf60b76fc6c778654673793d9",
  "O64#3": "4d0c16a1de400539ab04a88c3329bd64c1f04c2dd234646f8ef5cecac80f4228",
  "O64#4": "aee48be2abb6ac5b776c80a8ce292ef39f4eee0a26938df630eebd90b188d476",
  "O64#5": "b52817bc0ce6f246be299b5204a0a1ffeaf1caf85df35086c8b2453be4b35323",
  "O65#0": "95e651d5855ddbc47a3c936eaead8b476d4cc0d4f4614f31d67e21fcaed9902b",
  "O65#1": "c9be2aa68a8e0622043b1d004508e3af1e392a30bf9b5135daac6e145505ba7d",
  "O65#10": "abbc52259b41a12187cb165a9d7e4449a553673270081da1dbc5785a394d194e",
  "O65#11": "a93169c88a10d214cd3b5c3e8e0eee27afac3b5495e875d05b5451f1901f7d48",
  "O65#2": "4cdf2f7139353705712d1b58131bf7e0c79668d23c4684bfd237138ab6feb71d",
  "O65#3": "3b7a1b25505c9cfa4fb8ba2066b574037e94c1d1f2a15611b16d10b3aea757a7",
  "O65#4": "aceea835f7a3dc7c1e77577f37dea38fb1c3de44b625d6587c025b23d7bf32a4",
  "O65#5": "b9536342047565447266893079fbd4be965333659a7be2a69d30dce034fcd362",
  "O65#6": "414c7d89c02b69dd8d02548374c4b483dc722b3d437f189e9c733ef1d2cd0b21",
  "O65#7": "f9c6ed629ecfe990448de4f4d15b4c0978c6bcf8f3b4f4fec8ed2fe01273a4aa",
  "O65#8": "59ed8e3479a13de8e35db9b345de71d8b17e9cd800459bad53c8f1bc1586a69c",
  "O65#9": "69e9b30bb5398d85b16d4509a7e88b15fcb7ddd634920236a6c5ba4a9108ea49",
  "O66#0": "2cdcd5d377028b3171283ba35ceaff9915d300976f8803f13b71777cbe7de211",
  "O66#1": "297fd7154d42a7f991df7e6dedc88caac92493a1cef772c2f211157a85c7c7fb",
  "O66#2": "a34ea9b5984a8bc0cc7216af92aaf12558e0ce6d85d74951b7d67eca6d8b5010",
  "O67#0": "be01b0d8dc5535c0a895b53c7662d1c61cda2f6a169ae5a40008f72638feee2c",
  "O67#1": "eb596aaf859281eecee38c850d49279d2d620de85868f7044b63681e0fcc01cd",
  "O67#2": "7f314efb3e42976a7f8311826a2513da0cdb0109879f2e9dcfebe477dd08d130",
  "O69#0": "c1c8331190231a276ce1296d515139e1901b3c41364efba8445e83728ac60253",
  "O69#1": "f1cfbd07823eb6f035b1171b39ccb14bb248fdfd15eabbeb47fdd75bf7b0772b",
  "O69#2": "7feab70c6b79ebfc644a240fc2a3874e2cc088024e7945fc73c5704b6a8639c9",
  "O69#3": "cb7cd9c7fe602422c3a01e2b4efdf69afb3e2dc0386e8f9e86c01bdc4aea8550",
  "O69#4": "c4a7b1b147939ab878cbb70b8eae77b2ed469c638f32fd1d4fc0a1ac6eff3ef0",
  "O69#5": "705ba1274396bf7a3ee1e669222fccd01a029981cbf7c06f922174c675349e3d",
  "O69#6": "30f4387ad20376d23c99309c06b1b0908ddf77d7c51d2f935455cb2dee657273",
  "O7#0": "a7fe32846bbd40411a8c2032caaa2659c19df342239accb3c4f88a1135cc78ec",
  "O70#0": "bf9b1e4101ea2a988e2e78af8caff86744c3febc70a6130c9de27f156fa552f3",
  "O70#1": "fd302661adf3d35f8a77a569ea338fc72ee755215828f35ac8102a7056d81210",
  "O70#2": "c541f65e605ba7287b69e2b7fa625bf5935bc944121edfdc6e71781f88f31824",
  "O70#3": "3434143d15dfe6c4059304134759bb3ea3f8ae315dd10f033aaf3bafbfbc01f9",
  "O70#4": "7200d0bacb2b07407830d8ff34a752a6a243d00e15d87259c475f0e49b77f2ba",
  "O71#0": "7412feeaf9afbd894b0705451fa4dda6d299a763de02ce6b4c10b605a8c09011",
  "O71#1": "65089936e2407d22882f4caef5130e3701d84aa2606d2f54762471fd4e1931aa",
  "O71#2": "b3f4d5ad33c55bae0194408834cdf1ca71ebcace1f7349f751f999dc5ab682ac",
  "O71#3": "4564301e068cb1f1592923d7a9d47714b52af63ef1cb854ff001d6a2b720a60d",
  "O71#4": "306ea7e1290e00cd7c7ded520b9de2fc25501b321aa8e953e5a10ac58397c7e1",
  "O71#5": "c53f484615ee176ed3bb03d1d0a533df27fbcfc9198011d4cf0b8ca7d55007fa",
  "O71#6": "94c36b91feb2d116e467fbaf8256a0e469d5bf0a44033e172ac3d11b9a5d8420",
  "O71#7": "7b32b7a1afe49602d7ff242f93236c4b29c8f472101159dd219cf3cd680bdf4a",
  "O71#8": "f6a77bc017e15daf7f9beb2de07ca66f584de47529651e1b365a7c8b8aa760e4",
  "O72#0": "9fbba6a7e0c5e605ef11dd93a8e99b3eb6ecac1345e62d052d14a7ce774d737d",
  "O72#1": "59632709adbb52be3af0541952f0f31e26c6d75ef24177a445f49bd6c5a75ecf",
  "O72#2": "161807d1448427de8328f99919af3dc09e3603c3a2cdb85e2c8babb378f7fa31",
  "O72#3": "3a0d9ed0b832a781a41b6c7ca14215d0750f720073c8afa54cf46f5064eb41e4",
  "O73#0": "e5db5b83a92452da1683d70e500a8adcfa1ea8a9f5692e0a287cdce51df8c5a3",
  "O73#1": "cf58fddcb9e69d55d777a470d3092cbc98e417862992c62f2303e07f7e6bff50",
  "O73#2": "663d67f302f6a95244e4994f277c1833cdba279d677147354910050356fbc890",
  "O73#3": "bd70059445a649c2d79f4fa3934129ddc6db6acc54ff744edb499873eddabdf1",
  "O73#4": "4205a53ed753cb8bb0f519540601777f626f4d8cb770fd7df2b01de4e3e60be0",
  "O8#0": "f114617fb846483f736c2ab3e6174037241c465a03316ca261b95d2acc240efb",
  "O8#1": "db443900ac38801bc89cb32f035a31da832431bf527b6f240a91477fccd03e4e",
  "O8#2": "a761b805d35652ba8ab577974914cf3c64b3f4d0da5d4bff4790cff91605e706",
  "O8#3": "24710efc8980ba014f977e7bfea1213ff1f5fb173052696bdde7755193856b96",
  "O8#4": "023c88d122055ce8bd841b406fe18a93c8ed76e40f62295f5bfc9b4695021da1",
  "O8#5": "5249265de0149dd3fcdbcbf2fc37759bd8cf3b9e6fb5f75602c3bb15ab4f8d89",
  "O9#0": "3a235001e0edd04ef7eeca003f24f3cc1a872e62cd6d36ba93f9237eb3da79b0",
  "O9#1": "fb6a17a09578175d2f04634b6639304ab0efdaf4ff2f94078797653a61a1fd62",
  "O9#2": "8882abea9e25e5ef3b4caec397fab33376a79a5ab090c50aa9c2f3e0abdc90c3",
  "O9#3": "21f070bfc29420afdc03d39927d748b1e66a414beb70ec41de7ce0932794dfb3",
};

// ---- the samples as lists --------------------------------------------------------------

const KEEP_ALL = Object.entries(KEEP).flatMap(([group, list]) =>
  list.map((text, j) => ({ id: `${group}#${j}`, group, text })),
);
const REFUSE_ALL = Object.entries(REFUSE).flatMap(([group, list]) =>
  list.map(([form, text], j) => ({ id: `${group}#${j}`, group, form, text })),
);
const keepText = (id) => KEEP_ALL.find((s) => s.id === id).text;
const refuseText = (id) => REFUSE_ALL.find((s) => s.id === id).text;
const formOk = (sample, result) =>
  result !== null && sample.form.split("|").includes(result.form);

// The file O10: the samples of the groups O1-O8 and O11-O17, each on its own line
// (the groups O18-O26 are not in it; each of them has its own file).
const ASSEMBLY_GROUPS = [
  ...["O1", "O2", "O3", "O4", "O5", "O6", "O7", "O8"],
  ...["O11", "O12", "O13", "O14", "O15", "O16", "O17"],
];
const O10 = `${ASSEMBLY_GROUPS.flatMap((g) => KEEP[g]).join("\n")}\n`;
// The bytes of a file of one group: its samples, each on its own line.
const groupFile = (g) => `${KEEP[g].join("\n")}\n`;

const INPUTS = [
  [
    "writeResultFile",
    (p, name, text) => p.writer.writeResultFile({ name, content: text }),
  ],
  [
    "importWorkFile",
    (p, name, text) => {
      fs.writeFileSync(path.join(p.writer.workDir, name), text);
      return p.writer.importWorkFile({ path: name });
    },
  ],
  [
    "importResultBytes",
    (p, name, text) =>
      p.writer.importResultBytes({ name, bytes: Buffer.from(text, "utf8") }),
  ],
];

function freshProject(t) {
  const home = makeHome(t);
  return { ...startProject(t, home, makeClock()), home };
}

// A line of 60 ASCII characters, repeated to about 1 MiB: plain text with nothing in it.
const PLAIN_LINE =
  "The report is plain text with no keys and version 1.2 only.\n";
const PLAIN = PLAIN_LINE.repeat(Math.ceil(1_048_576 / PLAIN_LINE.length));
const MIDDLE =
  PLAIN_LINE.length * Math.floor(PLAIN.length / PLAIN_LINE.length / 2);

const POSITIONS = [
  ["alone", (s) => s],
  [
    "in the middle of 1 MiB",
    (s) => `${PLAIN.slice(0, MIDDLE)}${s}\n${PLAIN.slice(MIDDLE)}`,
  ],
  [
    "beside the samples O1-O3",
    (s) =>
      `${KEEP.O1[0]}\n${KEEP.O2[0]}\n${KEEP.O3.join("\n")}\n${s}\n${KEEP.O3.join("\n")}\n${KEEP.O1[0]}\n`,
  ], // Rework 08g (remark F1): O10 holds a kept sample of every form, so a real secret
  // that stands after it is found only if the scan goes on after each kept item.
  [
    "after the whole assembly O10, and again after it",
    (s) => `${O10}${s}\n${O10}`,
  ],
];

// The 8-character windows of a text.
function windows(text, size = 8) {
  const out = [];
  for (let i = 0; i + size <= text.length; i += 1)
    out.push(text.slice(i, i + size));
  return out;
}

function caught(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return assert.fail("expected the call to throw");
}

function assertSecretRefusal(err, name, sample, label) {
  assert.ok(err instanceof TeamError, `${label}: ${err}`);
  assert.equal(err.code, "E_WORK_FILE", label);
  assert.equal(err.details.reason, "secret", label);
  assert.ok(err.message.includes(name), `${label}: the name is in the text`);
  assert.match(err.message, /секрет/u, label);
  assert.match(err.message, /[А-Яа-яЁё]/u, `${label}: Russian`);
  assert.doesNotMatch(err.message, /\n\s+at /u, `${label}: no stack trace`);
  const shown = `${err.message}\n${JSON.stringify(err.details)}`;
  assert.equal(shown.includes(sample), false, `${label}: the sample is shown`);
  for (const w of windows(sample)) {
    assert.equal(shown.includes(w), false, `${label}: "${w}" is shown`);
  }
}

// ---- RB-00: the sample tables themselves ---------------------------------------------

test("RB-00 the sample tables hold every record of the requirement and the classes of its rules: 576 stored (O1-O26 less the assembly, O27-O35 of the first rework, O36-O61 of the second, O62-O71 of the fourth, O72-O73 of the fifth), 506 refused (C1-C26, C27-C34, C35-C55, C56-C58 of the third, C59-C71 of the fourth, C72-C73 of the fifth), the nine forms", () => {
  assert.equal(KEEP_ALL.length, 576);
  assert.equal(REFUSE_ALL.length, 506);
  assert.equal(new Set(KEEP_ALL.map((s) => s.text)).size, KEEP_ALL.length);
  assert.equal(new Set(REFUSE_ALL.map((s) => s.text)).size, REFUSE_ALL.length);
  assert.equal(KEEP.O26.length, 12);
  assert.equal(REFUSE.C26.length, 17);
  const forms = new Set(REFUSE_ALL.flatMap((s) => s.form.split("|")));
  assert.deepEqual(
    [...forms].sort(),
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `F${n}`),
  );
  assert.equal(KEEP.O9.length, 4);
  // the classes of the first rework: the closed set of white space and the numbers of rows
  assert.equal(WS.length, 25);
  assert.equal(new Set(WS).size, 25);
  assert.equal(SKIPPED.length, 23);
  assert.deepEqual(
    [27, 28, 29, 30, 31, 32, 33, 34, 35].map((n) => KEEP[`O${n}`].length),
    [24, 24, 23, 2, 2, 7, 7, 3, 4],
  );
  assert.deepEqual(
    [27, 28, 29, 30, 31, 32, 33, 34].map((n) => REFUSE[`C${n}`].length),
    [2, 21, 21, 4, 4, 4, 7, 5],
  );
  // the classes of the second rework (08g): the closed lists and sets, member by member
  assert.equal(V3_WORDS.length, 26);
  assert.equal(new Set(V3_WORDS).size, 26);
  assert.equal(SCHEMES.length, 9);
  assert.equal(NOT_SPACE_TAB.length, 23);
  assert.equal(KEYS.length, 7);
  assert.deepEqual(
    Array.from({ length: 26 }, (_, j) => KEEP[`O${36 + j}`].length),
    [
      26, 26, 6, 7, 20, 5, 23, 8, 4, 5, 25, 25, 14, 9, 18, 3, 6, 8, 9, 7, 7, 9,
      3, 6, 7, 4,
    ],
  );
  assert.deepEqual(
    Array.from({ length: 21 }, (_, j) => REFUSE[`C${35 + j}`].length),
    [26, 7, 4, 13, 4, 4, 4, 3, 20, 8, 3, 5, 10, 7, 19, 5, 9, 12, 4, 3, 2],
  );
  // the third rework (08i): a template with text after it
  assert.deepEqual(
    [56, 57, 58].map((n) => REFUSE[`C${n}`].length),
    [10, 9, 8],
  );
  // the fourth rework (08k): runs of white space, one optional quote, the whole value,
  // starts with, any case, only of
  assert.equal(RUNS_AUTH.length, 8);
  assert.equal(new Set(RUNS_AUTH).size, 8);
  assert.equal(RUNS_BEARER.length, 6);
  assert.equal(new Set(RUNS_BEARER).size, 6);
  assert.deepEqual(
    [62, 63, 64, 65, 66, 67, 69, 70, 71].map((n) => KEEP[`O${n}`].length),
    [8, 8, 6, 12, 3, 3, 7, 5, 9],
  );
  assert.deepEqual(
    Array.from({ length: 13 }, (_, j) => REFUSE[`C${59 + j}`].length),
    [8, 8, 6, 6, 5, 4, 7, 7, 26, 9, 2, 6, 6],
  );
  // the fifth rework (08m): a word just outside a closed list, the header with one
  // space exactly
  assert.deepEqual(
    [72, 73].map((n) => KEEP[`O${n}`].length),
    [4, 5],
  );
  assert.deepEqual(
    [72, 73].map((n) => REFUSE[`C${n}`].length),
    [7, 6],
  );
  for (const key of Object.keys(SHA)) {
    assert.match(SHA[key], /^[0-9a-f]{64}$/u, key);
  }
});

// ---- RB-01: criterion 1, storage byte for byte through the three inputs --------------

const STORED = [...KEEP_ALL, { id: "E:o10", group: "O10", text: O10 }];

for (const [kind, put] of INPUTS) {
  test(`RB-01 criterion 1 (${kind}): every sample of the groups O and the assembly O10 is stored byte for byte, the sha256 of the file and of the event are the literal one, mode 0600`, (t) => {
    const p = freshProject(t);
    const dir = path.join(p.dir, "files");
    STORED.forEach(({ id, text }, i) => {
      const name = `k-${String(i).padStart(3, "0")}.md`;
      const bytes = Buffer.from(text, "utf8");
      const event = put(p, name, text);
      const file = path.join(dir, name);
      const stored = fs.readFileSync(file);
      assert.equal(Buffer.compare(stored, bytes), 0, `${id}: the bytes differ`);
      assert.equal(sha256(stored), SHA[id], `${id}: sha256 of the file`);
      assert.equal(event.data.sha256, SHA[id], `${id}: sha256 of the event`);
      assert.equal(event.data.bytes, bytes.length, `${id}: bytes`);
      assert.equal(event.data.name, name);
      assert.equal(
        stored.includes(LABEL),
        false,
        `${id}: a label is in the file`,
      );
      assert.equal(modeOf(file), 0o600, id);
      if (kind === "importWorkFile") {
        const source = fs.readFileSync(path.join(p.writer.workDir, name));
        assert.equal(
          Buffer.compare(source, bytes),
          0,
          `${id}: the source changed`,
        );
      }
    });
    const events = journalOf(p.events).filter((e) => e.type === "RESULT_FILE");
    assert.deepEqual(
      events.map((e) => e.data.sha256),
      STORED.map(({ id }) => SHA[id]),
    );
    assert.equal(fs.readdirSync(dir).length, STORED.length);
  });
}

// ---- RB-02: BOM per input and the decoder of a scenario -------------------------------

const BOM_BYTES = Buffer.from([0xef, 0xbb, 0xbf, 0x41, 0x0d, 0x0a, 0x42]);
const BOM_SHA =
  "5ed797845fd2cdb56a4378eb7a200f09c587b4404858f738a5370d3bf7c2a3c6";

for (const [kind] of INPUTS) {
  test(`RB-02 criterion 1 (${kind}): a byte-order mark and CRLF are kept (7 bytes in, the same 7 bytes stored)`, (t) => {
    const p = freshProject(t);
    const text = BOM_BYTES.toString("utf8");
    assert.equal(text.charCodeAt(0), 0xfeff);
    if (kind === "importWorkFile") {
      fs.writeFileSync(path.join(p.writer.workDir, "bom.md"), BOM_BYTES);
      p.writer.importWorkFile({ path: "bom.md" });
    } else if (kind === "importResultBytes") {
      p.writer.importResultBytes({ name: "bom.md", bytes: BOM_BYTES });
    } else {
      p.writer.writeResultFile({ name: "bom.md", content: text });
    }
    const stored = fs.readFileSync(path.join(p.dir, "files", "bom.md"));
    assert.equal(Buffer.compare(stored, BOM_BYTES), 0);
    assert.equal(sha256(stored), BOM_SHA);
    const event = journalOf(p.events).at(-1);
    assert.equal(event.data.bytes, 7);
    assert.equal(event.data.sha256, BOM_SHA);
  });
}

test("RB-02 criterion 1: a scenario with a byte-order mark is still accepted by createProject and copied byte for byte (the decoder of the scenario is not changed)", (t) => {
  const home = makeHome(t);
  const bytes = fs.readFileSync(path.join(FIXTURES, "scenario-bom.json"));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const { id } = createProject(
    {
      goal: "Проверка сценария с меткой порядка байтов",
      budget_usd: 1,
      executor: "scripted",
      scenario_bytes: bytes,
    },
    { home },
  );
  const copy = fs.readFileSync(path.join(home, id, "scenario.json"));
  assert.equal(Buffer.compare(copy, bytes), 0);
  assert.equal(readProject(id, { home }).state.executor, "scripted");
});

// ---- RB-03: criterion 2 (a) and (d), depsOf ---------------------------------------------

// A project with the task t-0001 that "gave" the files and the task that depends on it.
function depsProject(t, names) {
  const p = freshProject(t);
  const w = p.writer;
  w.addTask(
    { role: "researcher", text: "Первая", done_when: "Есть файл" },
    "USER",
  );
  for (const name of names) {
    w.writeResultFile({ task: "t-0001", name, content: "placeholder" });
  }
  return { ...p, files: path.join(p.dir, "files") };
}
const DEP_TASK = { depends_on: ["t-0001"] };
const OLD_MARKS = [
  `password=${LABEL}`,
  `token: ${LABEL}`,
  `Authorization: ${LABEL}`,
  `https://u:${LABEL}@h/x`,
];

test("RB-03 criterion 2 (a): depsOf returns every sample of the groups O exactly as stored, no label (the read of a file of the reader is byte exact)", (t) => {
  const names = STORED.map((_, i) => `d-${String(i).padStart(3, "0")}.md`);
  const p = depsProject(t, names);
  STORED.forEach(({ text }, i) => {
    fs.writeFileSync(path.join(p.files, names[i]), text);
  });
  fs.writeFileSync(path.join(p.files, names[0]), "const v = a.b.c;");
  const before = snapshot(p.home);
  const deps = depsOf(p.writer, DEP_TASK);
  assert.equal(deps.length, STORED.length);
  assert.equal(
    deps[0].content,
    "const v = a.b.c;",
    "the R5 case of the diagnosis",
  );
  deps.slice(1).forEach((d, i) => {
    assert.equal(d.task, "t-0001");
    assert.equal(d.name, names[i + 1]);
    assert.equal(d.content, STORED[i + 1].text, STORED[i + 1].id);
  });
  assert.deepEqual(snapshot(p.home), before, "depsOf writes nothing");
});

const TAIL_SIZES = [100_000, 300_000, 2_500_000, 6_000_000];

test("RB-03 criterion 2 (d): depsOf withholds a file in which the check finds a secret - the bait of the group C, the marks of an older core, a 10 MiB key-shaped run, a bait at the very end of a plain file of 100000 / 300000 / 2.5 / 6 million characters - with a constant text, no exception, nothing written, the neighbour exact", (t) => {
  const baits = REFUSE_ALL.map((s) => s.text);
  const names = [
    "clean.md",
    ...baits.map((_, i) => `b-${String(i).padStart(3, "0")}.md`),
    ...OLD_MARKS.map((_, i) => `old-${i}.md`),
    "ok-mark.md",
    "huge.md",
    ...TAIL_SIZES.map((size) => `tail-${size}.md`),
    "clean2.md",
  ];
  const p = depsProject(t, names);
  const put = (name, text) => fs.writeFileSync(path.join(p.files, name), text);
  put("clean.md", "const v = a.b.c;");
  baits.forEach((text, i) => put(names[1 + i], text));
  OLD_MARKS.forEach((text, i) => put(`old-${i}.md`, text));
  put("ok-mark.md", `const v = ${LABEL};`);
  put("huge.md", `${GHP}${"A".repeat(10 * 1024 * 1024)}`);
  // a read-side cap: the bait stands at the very end of a long plain file, beyond 100000
  // characters, beyond PROMPT_MAX and beyond 1 MiB (the requirement: EVERY file that is read)
  for (const size of TAIL_SIZES) {
    const plain = PLAIN_LINE.repeat(Math.ceil(size / PLAIN_LINE.length)).slice(
      0,
      size,
    );
    put(`tail-${size}.md`, `${plain}\n${GHP}${N(36)}`);
  }
  put("clean2.md", keepText("O1#0"));
  const before = snapshot(p.home);
  const state = structuredClone(p.writer.state);
  const deps = depsOf(p.writer, DEP_TASK);
  assert.deepEqual(
    deps.map((d) => d.name),
    names,
  );
  const by = Object.fromEntries(deps.map((d) => [d.name, d.content]));
  assert.equal(by["clean.md"], "const v = a.b.c;");
  assert.equal(by["clean2.md"], keepText("O1#0"));
  assert.equal(
    by["ok-mark.md"],
    `const v = ${LABEL};`,
    "a label alone is no secret",
  );
  for (const name of names.filter((n) => /^(b-|old-|huge|tail-)/u.test(n))) {
    assert.equal(by[name], WITHHELD, name);
  }
  for (const d of deps) {
    if (d.content === WITHHELD) continue;
    assert.equal(d.content.includes(GHP), false);
  }
  assert.deepEqual(snapshot(p.home), before, "the files on disk do not change");
  assert.deepEqual(p.writer.state, state, "the state does not change");
});

test("RB-03 criterion 2 (d): the file of an older core with the label of a secret is withheld, a file of 5.3 MiB and more cannot make depsOf throw", (t) => {
  const p = depsProject(t, ["old.md", "big.md"]);
  fs.writeFileSync(
    path.join(p.files, "old.md"),
    `Ключ: ${GHP}${N(36)} и password=${LABEL}`,
  );
  fs.writeFileSync(
    path.join(p.files, "big.md"),
    `${GHP}${"B".repeat(5_700_000)}`,
  );
  const deps = depsOf(p.writer, DEP_TASK);
  assert.deepEqual(
    deps.map((d) => d.content),
    [WITHHELD, WITHHELD],
  );
});

// ---- RB-05: criterion 2 (c), the limit of a request -----------------------------------------

const LONG = `${keepText("O1#0")}\n`.repeat(5100);

test("RB-05 criterion 2 (c): a file over PROMPT_MAX (200000 characters) is stored byte for byte and depsOf returns it whole", (t) => {
  assert.ok(LONG.length > 200_000);
  const p = freshProject(t);
  p.writer.addTask(
    { role: "researcher", text: "Первая", done_when: "Есть файл" },
    "USER",
  );
  const event = p.writer.writeResultFile({
    task: "t-0001",
    name: "long.md",
    content: LONG,
  });
  assert.equal(event.data.sha256, SHA["E:long"]);
  assert.equal(event.data.bytes, LONG.length);
  const stored = fs.readFileSync(path.join(p.dir, "files", "long.md"), "utf8");
  assert.equal(stored === LONG, true);
  const deps = depsOf(p.writer, DEP_TASK);
  assert.equal(deps.length, 1);
  assert.equal(deps[0].content === LONG, true, "the whole content comes back");
});

// ---- RB-06: criterion 3, the refusal on three inputs in three positions ----------------

for (const [kind, put] of INPUTS) {
  test(`RB-06 criterion 3 (${kind}): every sample of the groups C is refused with E_WORK_FILE and reason "secret", alone, in the middle of 1 MiB and beside other samples; the text is Russian, names the file, shows no part of the sample and no stack`, (t) => {
    const p = freshProject(t);
    // control: 1 MiB of plain text is accepted, so the refusals below come from the sample
    put(p, "control.md", PLAIN);
    for (const [where, place] of POSITIONS) {
      REFUSE_ALL.forEach((sample, i) => {
        const name = `c-${String(i).padStart(3, "0")}.md`;
        const label = `${kind} ${sample.id} ${where}`;
        const err = caught(() => put(p, name, place(sample.text)));
        assertSecretRefusal(err, name, sample.text, label);
        assert.equal(
          fs.existsSync(path.join(p.dir, "files", name)),
          false,
          label,
        );
      });
    }
  });
}

// ---- RB-06 (order and tail): the scan goes on after a kept item and to the last byte ------
//
// Rework 08g (remark F1 and F4 of the second gate, AP-110): a scan that stops, or skips
// ahead, after the first kept item of a form (the first certificate, the first address with
// a placeholder, the first Bearer template, the first expression pair, the first run that
// is no JWT) would store a real secret that stands later in the same file. The test is by
// the class: a kept sample of the form before the secret, after it, and in a row; the
// requirement says that a file is refused if there is at least one secret in it.

// [form, the kept sample, the sample that is refused] - one pair for each of the forms.
const ORDER_FORMS = [
  ["F1", "O11#0", "C5#0"],
  ["F1", "O7#0", "C10#0"],
  ["F2", "O12#6", "C11#2"],
  ["F8", "O12#4", "C12#1"],
  ["F3", "O8#4", "C7#0"],
  ["F7", "O17#5", "C6#0"],
  ["F9", "O13#7", "C8#0"],
  ["F4", "O17#0", "C3#0"],
  ["F5", "O22#0", "C1#0"],
  ["F6", "O17#4", "C4#0"],
];
const ORDER_SHAPES = [
  (kept, secret) => `${kept}\n${secret}\n`,
  (kept, secret) => `${secret}\n${kept}\n`,
  (kept, secret) => `${kept}\n${kept}\n${secret}\n${kept}`,
];

for (const [kind, put] of INPUTS) {
  test(`RB-06 criterion 3 (${kind}, order): a real secret after a kept item of the same form, before it and between two of them is refused, for each of the nine forms; the state is unchanged`, (t) => {
    const p = freshProject(t);
    let counter = 0;
    for (const [form, keptId, secretId] of ORDER_FORMS) {
      const kept = keepText(keptId);
      const secret = refuseText(secretId);
      ORDER_SHAPES.forEach((shape, j) => {
        counter += 1;
        const name = `order-${counter}.md`;
        const text = shape(kept, secret);
        if (kind === "importWorkFile") {
          fs.writeFileSync(path.join(p.writer.workDir, name), text);
        }
        const before = worldOf(p);
        const err = caught(() => put(p, name, text));
        assertSecretRefusal(err, name, secret, `${kind} ${form} shape ${j}`);
        assert.deepStrictEqual(worldOf(p), before, `${form} shape ${j}`);
      });
    }
    // the kept sample alone is accepted, so the refusals come from the secret
    put(p, "kept-alone.md", keepText("O11#0"));
  });
}

test("RB-07 criterion 3 (order): every stored sample (and the assembly O10) before and after every refused sample, in one file, is refused", () => {
  const kept = [...KEEP_ALL.map((s) => s.text), O10];
  let checks = 0;
  for (const secret of REFUSE_ALL) {
    for (const text of kept) {
      for (const joined of [
        `${text}\n${secret.text}`,
        `${secret.text}\n${text}`,
      ]) {
        checks += 1;
        if (findSecrets(joined) === null) {
          assert.fail(
            `${secret.id} is not found next to ${JSON.stringify(text)}`,
          );
        }
      }
    }
  }
  assert.equal(checks, kept.length * REFUSE_ALL.length * 2);
});

// The nine forms, one refused sample for each; the largest file that is accepted is 5 MiB,
// the body here is about 4.8 MiB and the sample stands in its last bytes.
const FORM_SAMPLES = [
  ["F1", "C5#0"],
  ["F2", "C11#0"],
  ["F3", "C7#0"],
  ["F4", "C3#0"],
  ["F5", "C1#0"],
  ["F6", "C4#0"],
  ["F7", "C6#0"],
  ["F8", "C12#0"],
  ["F9", "C8#0"],
];
const TAIL_BODY = PLAIN.repeat(5).slice(
  0,
  PLAIN_LINE.length * Math.floor(4_999_000 / PLAIN_LINE.length),
);

for (const [kind, put] of INPUTS) {
  test(`RB-06 criterion 3 (${kind}, tail): a secret in the last bytes of a text of about 4.8 MiB is refused for each of the nine forms, the same text without it is accepted`, (t) => {
    assert.ok(TAIL_BODY.length > 4_000_000 && TAIL_BODY.length < 5_000_000);
    assert.ok(TAIL_BODY.endsWith("\n"));
    const p = freshProject(t);
    put(p, "tail-control.md", TAIL_BODY);
    for (const [form, id] of FORM_SAMPLES) {
      const secret = refuseText(id);
      const name = `tail-${form}.md`;
      const text = TAIL_BODY + secret;
      if (kind === "importWorkFile") {
        fs.writeFileSync(path.join(p.writer.workDir, name), text);
      }
      const before = worldOf(p);
      const err = caught(() => put(p, name, text));
      assertSecretRefusal(err, name, secret, `${kind} ${form} at the tail`);
      assert.deepStrictEqual(worldOf(p), before, form);
      assert.equal(fs.existsSync(path.join(p.dir, "files", name)), false, form);
    }
  });
}

// ---- RB-20 (sweeps): the rules by the class of a character ------------------------------------------

test("RB-20 criterion 3 (sweeps, findSecrets): for every character of every sweep the text is stored or refused as the set in the words of the requirement says", () => {
  assert.equal(SWEEPS.length, 430);
  assert.equal(SWEEP_ROWS.length, 393701);
  assert.equal(new Set(SWEEP_ROWS.map((r) => r.id)).size, SWEEP_ROWS.length);
  const wrong = SWEEP_ROWS.filter(
    (r) => (findSecrets(r.text) === null) !== r.stored,
  );
  // only the first 20 wrong rows go into the message: a loud mutant must end in a short
  // failure, not in a diff of hundreds of thousands of strings (remark F3 of 08n)
  assert.equal(
    wrong.length,
    0,
    `${wrong.length} rows give the other side, the first 20: ${wrong
      .slice(0, 20)
      .map((r) => `${r.id} ${r.stored ? "stored" : "refused"}`)
      .join(", ")}`,
  );
  // both sides are present in every sweep that is not a refusal-only sweep
  for (const [id, , , , stored] of SWEEPS) {
    const rows = SWEEP_ROWS.filter((r) => r.id.startsWith(`${id}#`));
    assert.ok(rows.length > 0, id);
    assert.ok(
      rows.some((r) => r.stored === false),
      `${id}: no refused row`,
    );
    if (!/^K[2-5]$/u.test(id)) {
      assert.ok(
        rows.some((r) => r.stored === true),
        `${id}: no stored row`,
      );
    }
    assert.equal(typeof stored, "function");
  }
});

for (const [kind, put] of INPUTS) {
  const turn = INPUTS.findIndex(([k]) => k === kind);
  test(`RB-20 criterion 3 (${kind}, sweeps): every third row of the earlier sweeps and every 400th row of the exhaustive sweeps goes through the store (each input takes a third of those) - a stored text is kept byte for byte, a refused one is refused with reason secret and leaves nothing`, (t) => {
    const p = freshProject(t);
    const dir = path.join(p.dir, "files");
    let stored = 0;
    let refused = 0;
    SWEEP_ROWS.forEach((row, i) => {
      // the sweeps of the earlier reworks: every third row; the sweeps of the exhaustive
      // slot rule (rework 08m, 360 thousand rows): every 400th row, so that the call
      // sites are tried on every kind of sweep and the file stays within its time
      const j = i - OLD_SWEEP_ROWS;
      const taken =
        j < 0
          ? i % 3 === 0 && (i / 3) % INPUTS.length === turn
          : j % 400 === 0 && (j / 400) % INPUTS.length === turn;
      if (!taken) return;
      const name = `s-${i}.md`;
      const bytes = Buffer.from(row.text, "utf8");
      if (kind === "importWorkFile") {
        fs.writeFileSync(path.join(p.writer.workDir, name), bytes);
      }
      if (row.stored) {
        put(p, name, row.text);
        stored += 1;
        assert.equal(
          Buffer.compare(fs.readFileSync(path.join(dir, name)), bytes),
          0,
          row.id,
        );
      } else {
        const err = caught(() => put(p, name, row.text));
        assert.equal(err.details?.reason, "secret", row.id);
        assert.equal(fs.existsSync(path.join(dir, name)), false, row.id);
        refused += 1;
      }
    });
    assert.ok(
      stored > 100 && refused > 100,
      `${stored} stored, ${refused} refused`,
    );
    assert.equal(
      fs.readdirSync(dir).filter((n) => n.startsWith(".")).length,
      0,
    );
    assert.equal(fs.readdirSync(dir).length, stored);
  });
}

// ---- RB-07: the forms --------------------------------------------------------------------

test("RB-07 criterion 3: findSecrets returns the expected form of the table for every sample of the groups C, nothing for the groups O, the nine forms are covered; a refused sample stays refused inside text and beside O1 and O3", () => {
  const filler = PLAIN.slice(0, 10_000);
  const seen = new Set();
  for (const sample of REFUSE_ALL) {
    const result = findSecrets(sample.text);
    assert.ok(
      formOk(sample, result),
      `${sample.id}: ${JSON.stringify(result)}`,
    );
    seen.add(result.form);
    assert.deepEqual(Object.keys(result), ["form"], "no value, no position");
    for (const text of [
      `${filler}\n${sample.text}\n${filler}`,
      `${keepText("O1#0")}\n${sample.text}\n${keepText("O3#1")}`,
      `${O10}${sample.text}\n${O10}`,
      `${sample.text}\n${O10}`,
    ]) {
      assert.notEqual(findSecrets(text), null, `${sample.id} inside a text`);
    }
  }
  assert.deepEqual([...seen].sort(), [
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
  ]);
  for (const sample of KEEP_ALL) {
    assert.equal(findSecrets(sample.text), null, sample.id);
  }
  assert.equal(
    findSecrets(KEEP_ALL.map((s) => s.text).join("\n")),
    null,
    "the assembly of all",
  );
  assert.equal(findSecrets(O10), null);
});

test("RB-07 criterion 1: the nine samples of the plan (AC0.3) are stored, alone and inside one HTML page", () => {
  const nine = [
    ...KEEP.O4,
    keepText("O3#1"),
    ...KEEP.O5,
    ...KEEP.O6,
    ...KEEP.O7,
  ];
  assert.equal(nine.length, 9);
  for (const s of nine) assert.equal(findSecrets(s), null, s);
  const page = `<!doctype html>\n<html lang="ru"><body>\n${nine.map((s) => `<pre>${s}</pre>`).join("\n")}\n</body></html>\n`;
  assert.equal(findSecrets(page), null);
});

// ---- RB-08: the pairs of the boundary ---------------------------------------------------------

const hex = (w) =>
  `U+${w.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
// The refused partner of a character after the colon: its own row of C28, or the older
// row of the same kind (the line ends have no refused row of their own: with a line
// end the value is not taken, and a wide space takes it).
function refusedAfterColon(w) {
  const at = C28_WS.indexOf(w);
  if (at >= 0) return `C28#${at}`;
  return w === "\u000c" ? "C11#17" : "C11#15";
}
function refusedAfterScheme(w) {
  const at = C29_WS.indexOf(w);
  return at >= 0 ? `C29#${at}` : "C11#16";
}

// The stored chain / your rows and their refused neighbours (same order, same shape).
function O69Pairs() {
  return KEEP.O69.map((_, i) => [
    `O69#${i}`,
    `C65#${i}`,
    "Z: a chain of x, X, * alone is a placeholder / the chain and more characters",
  ]);
}
function O70Pairs() {
  const partner = [0, 1, 2, 3, "O26#10", "O26#11", 4];
  return partner.map((p, i) => [
    typeof p === "string" ? p : `O70#${p}`,
    `C66#${i}`,
    "Z: a value that starts with your is a placeholder / a character before your",
  ]);
}

// [stored sample, refused sample, what the pair separates]
const PAIRS = [
  ["O7#0", "C10#6", "F1: the whole certificate line / the truncated header"],
  ["O7#0", "C10#4", "F1: certificate / public key block"],
  ["O7#0", "C10#3", "F1: certificate / an unknown label"],
  ["O7#0", "C10#7", "F1: capital letters / small letters"],
  ["O7#0", "C10#9", "F1: five dashes / six dashes on the left"],
  ["O7#0", "C10#10", "F1: five dashes / six dashes on the right"],
  ["O11#1", "C10#8", "F1: the certificate in code / the bare marker in code"],
  ["O12#6", "C11#2", "F2: a template after the scheme / a literal"],
  ["O12#6", "C11#16", "F2: the same with a wide space after the scheme"],
  ["O12#2", "C11#11", "F2: a quoted key, double quotes"],
  ["O12#3", "C11#12", "F2: a quoted key, single quotes"],
  ["O12#8", "C11#13", "F2: a quoted key, back quotes"],
  ["O12#7", "C11#8", "F2: a camelCase identifier / a plain word"],
  ["O12#7", "C11#9", "F2: no scheme / after a scheme"],
  ["O12#7", "C11#14", "F2: unquoted / in quotes"],
  ["O12#13", "C11#14", "F2: a template in quotes / a literal in quotes"],
  [
    "O12#14",
    "C11#15",
    "F2: a no-break space before a template / before a literal",
  ],
  ["O8#2", "C15#1", "F3: a template password / a dollar sign inside"],
  ["O8#2", "C15#2", "F3: a template password / braces inside"],
  ["O8#2", "C15#3", "F3: a template password / an open angle bracket"],
  ["O16#0", "C15#5", "F3: a placeholder / the name as the password"],
  ["O17#5", "C6#0", "F7: two parts / three parts"],
  ["O17#7", "C6#0", "F7: not eyJ / eyJ"],
  ["O17#5", "C21#0", "F7: a period at the end counts as punctuation"],
  ["O12#4", "C12#1", "F8: a template-like value / a short literal"],
  ["O12#12", "C12#1", "F8: the value on the next line is not taken / taken"],
  ["O12#12", "C12#3", "F8: next line / prose"],
  ["O23#0", "C12#1", "F8: a letter before the word / none"],
  ["O22#0", "C1#0", "F5: a letter on the left / none"],
  ["O22#1", "C4#0", "F6: a letter on the left / none"],
  ["O22#1", "C23#0", "F6: a letter on the left / an underscore on the left"],
  ["O6#1", "C13#16", "F9: a path / a literal that ends at a comma"],
  ["O13#1", "C13#14", "F9: a type word / a short word"],
  ["O13#1", "C13#10", "F9: a type word / three letters"],
  ["O14#11", "C14#5", "F9 quoted: a template inside / text around it"],
  ["O14#10", "C14#7", "F9 quoted: a pure template / a template inside text"],
  ["O20#0", "C18#0", "group: one line / the closer on the next line"],
  ["O20#2", "C18#1", "group: ${{ one line / next line"],
  ["O20#5", "C18#2", "group: <...> one line / next line"],
  ["O20#1", "C19#0", "group: not empty / empty ${}"],
  ["O20#2", "C19#1", "group: not empty / empty ${{}}"],
  ["O20#3", "C19#2", "group: not empty / empty {{}}"],
  ["O20#4", "C19#3", "group: not empty / empty <>"],
  ["O20#4", "C20#0", "group: no second < inside <...>"],
  ["O20#2", "C20#1", "group: ${{ closes only with }}"],
  ["O18#0", "C16#0", "scheme Negotiate: a template / a literal"],
  ["O18#1", "C16#1", "scheme NTLM"],
  ["O18#2", "C16#2", "scheme OAuth"],
  ["O18#3", "C16#3", "scheme ApiKey"],
  ["O18#4", "C16#4", "scheme Bot"],
  ["O19#0", "C17#0", "path with ?.: letters only / a digit"],
  ["O19#1", "C17#1", "path with ?.: letters only / a digit"],
  ["O21#0", "C22#0", "the chain of x: three / two"],
  ["O21#1", "C22#1", "the chain of *: three / two"],
  ["O24#0", "C24#0", "the semicolon ends the value"],
  ["O25#0", "C25#0", "trailing closers are counted"],
  ["O25#1", "C25#0", "trailing closers are counted, braces"],
  [
    "O26#0",
    "C26#11",
    "placeholder example in a value / glued secret (no quotes)",
  ],
  ["O26#4", "C26#12", "placeholder your-token / glued secret"],
  ["O26#6", "C26#9", "your in quotes / glued secret in quotes"],
  ["O26#7", "C26#14", "pw-example in quotes / glued secret in quotes"],
  ["O26#8", "C26#13", "pw-example in an address / glued secret"],
  ["O26#10", "C26#15", "after a scheme: YOUR_CREDENTIALS / glued secret"],
  ["O26#11", "C26#16", "after Bearer: YOUR_TOKEN / glued secret"],
  // Rework 08c (remark F1): the pairs of the groups O27-O34 and C27-C34.
  ...O27_WS.map((w, i) => [
    `O27#${i}`,
    refusedAfterColon(w),
    `F2: ${hex(w)} after the colon: a template / a literal`,
  ]),
  ...O28_WS.map((w, i) => [
    `O28#${i}`,
    refusedAfterScheme(w),
    `F2: ${hex(w)} after Basic: a template / a literal`,
  ]),
  ...O29_WS.map((w, i) => [
    `O29#${i}`,
    "C12#1",
    `F8: ${hex(w)} after Bearer takes no value / a space does`,
  ]),
  [
    "O12#7",
    "C27#1",
    "F2: no scheme, a bare identifier is an expression / after Bearer it is a literal",
  ],
  [
    "O12#9",
    "C27#0",
    "F8: a placeholder after Bearer / a bare identifier after Bearer",
  ],
  ["O30#0", "C30#0", "F8: an underscore on the left / none, small letters"],
  ["O30#0", "C30#1", "F8: an underscore on the left / a hyphen"],
  ["O30#1", "C30#2", "F8: a digit on the left / a period"],
  ["O30#1", "C30#3", "F8: a digit on the left / a bracket"],
  ["O31#0", "C31#0", "%NAME%: a template / a name that starts with a digit"],
  ["O31#1", "C31#1", "%NAME%: a template / no closing percent sign"],
  ["O31#0", "C31#3", "%NAME%: a template / text around it"],
  ["O31#1", "C31#2", "$NAME, %NAME%: a name / a name that starts with a digit"],
  ...KEEP.O32.flatMap((_, i) =>
    REFUSE.C32.map((__, j) => [
      `O32#${i}`,
      `C32#${j}`,
      "F7: a JWT inside a longer run / a JWT after a separator",
    ]),
  ),
  ["O33#0", "C33#0", "F5 ghp_: 19 characters / 20"],
  ["O33#1", "C33#1", "F5 gho_: 19 characters / 20"],
  ["O33#2", "C33#2", "F5 ghs_: 19 characters / 20"],
  ["O33#3", "C33#3", "F5 github_pat_: 19 characters / 20"],
  ["O33#4", "C33#4", "F4 sk-: 15 characters / 16"],
  ["O33#5", "C33#5", "F4 sk-: 15 with an underscore / 16 with an underscore"],
  ["O33#6", "C33#6", "F4 sk-: 15 with a hyphen / 16 with a hyphen"],
  ["O35#0", refusedAfterColon(" "), "F2: a newline after the colon / a space"],
  ["O35#1", "C11#2", "F2: a newline after Basic / a space"],
  [
    "O35#2",
    refusedAfterColon(" "),
    "F2: a carriage return after the colon / a space",
  ],
  ["O35#3", "C11#2", "F2: a carriage return after Basic / a space"],
  ...KEEP.O34.flatMap((_, i) =>
    REFUSE.C34.map((__, j) => [
      `O34#${i}`,
      `C34#${j}`,
      "F3: a character outside [A-Za-z0-9+.-] before :// / one inside",
    ]),
  ), // Rework 08g (remarks F1 and F2): the pairs of the groups O36-O51 and C35-C45.
  ...V3_WORDS.flatMap((w, i) => [
    [
      `O36#${i}`,
      `C35#${i}`,
      `V3: "${w}" is an expression / with one more letter a literal`,
    ],
    [`O37#${i}`, `C35#${i}`, `V3: "${w.toUpperCase()}" (any case) / a literal`],
  ]),
  ["O38#0", "C36#5", "V3: _ and a letter / the same with a digit"],
  ["O38#0", "C36#6", "V3: _ and a letter / a hyphen"],
  ["O38#1", "C36#0", "V3: _ and a letter / only underscores"],
  ["O38#1", "C36#1", "V3: _ and a letter / one underscore"],
  ["O38#2", "C36#2", "V3: lower before upper / upper before lower"],
  ["O38#2", "C36#3", "V3: lower before upper / all upper"],
  ["O38#5", "C36#4", "V3: lower before upper at the end / upper, upper, lower"],
  ["O39#0", "C37#0", "V4: [ / <"],
  ["O39#1", "C37#1", "V4: ( / -"],
  ["O39#2", "C37#3", "V4: | / | and a letter"],
  ["O39#3", "C37#1", "V4: > / -"],
  ["O39#4", "C37#2", "V4: the five characters / the same with a letter"],
  ["O40#0", "C11#6", "F2: Digest with a template / with a literal"],
  ["O40#1", "C11#5", "F2: Token with a template / with a literal"],
  ...SCHEMES.flatMap((s, i) => [
    [
      `O40#${2 + i}`,
      `C38#${4 + i}`,
      `F2: ${s} in lower case / a literal after it`,
    ],
    [
      `O40#${11 + i}`,
      `C38#${4 + i}`,
      `F2: ${s} in upper case / a literal after it`,
    ],
  ]),
  ["O40#2", "C38#0", "F2: Basic / Basics is no scheme"],
  ["O40#4", "C38#1", "F2: Digest / Digests is no scheme"],
  ["O40#6", "C38#2", "F2: Negotiate / Negotiat is no scheme"],
  ["O40#10", "C38#3", "F2: Bot / Bo is no scheme"],
  ["O41#0", "C39#0", "F9: a tab after the colon: a template / a literal"],
  ["O41#1", "C39#1", "F9: a tab after the equal sign: a template / a literal"],
  [
    "O41#2",
    "C39#2",
    "F9: space and tab after the colon: a template / a literal",
  ],
  ["O41#4", "C39#3", "F9: two spaces: a template / a literal"],
  ...NOT_SPACE_TAB.map((w, i) => [
    `O42#${i}`,
    i % 2 ? "C39#1" : "C39#3",
    `F9: ${hex(w)} after the sign takes no value / a space or a tab does`,
  ]),
  ["O43#0", "C40#3", "closers: ) dropped / text after it"],
  ["O43#1", "C40#3", "closers: ] dropped / text after it"],
  ["O43#2", "C40#3", "closers: } dropped / text after it"],
  ["O43#0", "C40#0", "closers: ) without a pair dropped / a pair is kept"],
  ["O43#1", "C40#1", "closers: ] without a pair dropped / a pair is kept"],
  ["O43#2", "C40#2", "closers: } without a pair dropped / a pair is kept"],
  ["O43#3", "C40#2", "closers: two } dropped / one pair kept"],
  ["O43#4", "C40#0", "closers: two ) dropped / one pair kept"],
  ["O43#5", "C40#1", "closers: two ] dropped / one pair kept"],
  ["O43#6", "C40#0", "closers: three kinds dropped in turn / a pair kept"],
  ["O43#7", "C40#3", "closers: ] and } after a name with a colon / text after"],
  ["O44#0", "C41#3", "F7: an empty middle part / three parts"],
  ["O44#1", "C41#3", "F7: an empty third part in the middle / three parts"],
  ["O44#2", "C41#1", "F7: dots at the end, two parts / three parts and dots"],
  ["O44#3", "C41#2", "F7: dots at the end, one part / three parts and dots"],
  ["O45#0", "C42#1", "F3: an empty password / a password of one character"],
  ["O45#1", "C42#2", "F3: white space in the password / none"],
  ["O45#2", "C42#2", "F3: a slash in the user / none"],
  ["O45#3", "C42#2", "F3: an at sign in the user / none"],
  ["O45#4", "C42#2", "F3: a slash in the password / none"],
  ...WS.flatMap((w, i) => [
    [`O46#${i}`, "C42#2", `F3: ${hex(w)} in the password / none`],
    [`O47#${i}`, "C42#2", `F3: ${hex(w)} in the user / none`],
  ]),
  ["O45#0", "C42#0", "F3: an empty password / a colon inside the password"],
  ...KEYS.flatMap((key, i) => {
    const out = [0, 1].map((j) => [
      `O48#${2 * i + j}`,
      `C43#${2 * i + j}`,
      `F4-F6: key ${i}, a ${j ? "digit" : "letter"} on the left / a dash or an equal sign`,
    ]);
    if (i !== 5) {
      out.push([
        `O48#${2 * i}`,
        `C43#${14 + (i < 5 ? i : i - 1)}`,
        `F4-F6: key ${i}, a letter on the left / an underscore`,
      ]);
    }
    return out;
  }),
  ...Array.from({ length: 7 }, (_, j) => [
    `O49#${j}`,
    `C44#${j}`,
    "F6: a character of the right set after the body / a character outside it",
  ]),
  ["O49#7", "C44#7", "F6 ASIA: a letter after the body / a period"],
  ["O49#8", "C44#7", "F6 ASIA: a hyphen after the body / a period"],
  ["O17#4", "C44#1", "F6: a letter after the body / a space"],
  ...Array.from({ length: 18 }, (_, k) => [
    `O50#${k}`,
    k < 16 ? "C45#0" : "C45#2",
    "F6: a lower-case letter in the body / capitals only",
  ]),
  ["O50#0", "C45#1", "F6: a lower-case letter in the body / digits only"],
  ...[0, 1, 2].map((j) => [
    `O51#${j}`,
    "C33#4",
    "F4: a character outside the set cuts the body / 16 characters in a row",
  ]),
  ["O52#0", "C46#0", "Sh: $(A) in quotes / an empty $() first"],
  ["O52#2", "C46#1", "Sh: $(A) as a password / an empty $() first"],
  ["O52#3", "C42#2", "F3: a user that ends with ) / a plain password"],
  ["O53#0", "C48#1", "Sh: the shortest %NAME% / a lone %"],
  ["O53#1", "C48#0", "Sh: the shortest $NAME / a lone $"],
  ["O53#0", "C48#4", "Sh: %A% / a name that starts with a digit"],
  ["O54#0", "C49#13", "Z: your / you"],
  ["O54#3", "C49#11", "Z: example in any case / one letter short"],
  ["O54#6", "C49#17", "Z: example inside a word / a character outside the set"],
  [
    "O55#3",
    "C14#7",
    "quotes: a group with an escaped quote / a group inside text",
  ],
  [
    "O55#6",
    "C47#0",
    "quotes: a group with an escaped brace / a group not closed",
  ],
  ["O56#0", "C51#0", "closers: ( and ] / ( and )"],
  ["O56#1", "C51#1", "closers: [ and ) / [ and ]"],
  ["O56#5", "C51#2", "closers: { and ] / { and }"],
  [
    "O57#5",
    "C52#3",
    "F8: a quote and the end of the text / a quote and a letter",
  ],
  ["O57#6", "C52#4", "F8: a single quote and the end / and a letter"],
  ["O57#7", "C52#7", "F2: a quote after Basic and the end / and a letter"],
  ["O57#2", "C52#10", "F2: a scheme alone / a scheme with a template glued"],
  ["O57#3", "C52#11", "F2: Bot alone / Bot with a template glued"],
  ["O58#0", "C14#0", "quotes: an empty string at the end of a line / a value"],
  ["O59#0", "C8#0", "a pair inside a group is not read / a pair"],
  ...Array.from({ length: 7 }, (_, j) => [
    `O60#${j}`,
    "C42#2",
    "F3: not an address with a user and a password / a user and a password",
  ]),
  ["O61#0", "C10#8", "F1: a short marker / the marker"],
  ["O61#1", "C5#1", "F1: four dashes / five dashes"],
  ["O61#2", "C41#3", "F7: ey.. / eyJ.."],
  ["O61#3", "C41#3", "F7: eyK / eyJ"],
  // rework 08i (F1): a template is the whole value - a group alone / a group and then text
  ["O14#10", "C56#0", "Sh quoted: ${...} alone / ${...} and text after"],
  ["O14#11", "C56#1", "Sh quoted: <...> alone / <...> and text after"],
  ["O52#0", "C56#2", "Sh quoted: $(...) alone / $(...) and text after"],
  ["O14#12", "C56#3", "Sh quoted: {{...}} alone / {{...}} and text after"],
  ["O20#2", "C56#4", "Sh: ${{...}} alone / ${{...}} and text in quotes"],
  ["O55#1", "C56#5", "Sh quoted: %NAME% alone / %NAME% and text after"],
  ["O14#13", "C56#6", "Sh quoted: back quotes, a group alone / and text"],
  ["O14#10", "C56#7", "Sh quoted: one group / two groups in a row"],
  ["O20#1", "C56#8", "Sh unquoted: one group / two groups in a row"],
  ["O55#0", "C56#9", "Sh quoted: $NAME alone / $NAME, a dot, text"],
  ["O12#6", "C57#0", "F2 after Basic: a template / a quoted ${...} and text"],
  ["O12#6", "C57#1", "F2 after Basic: a template / a quoted <...> and text"],
  ["O12#6", "C57#2", "F2 after Basic: a template / a quoted $(...) and text"],
  ["O12#6", "C57#3", "F2 after Basic: a template / a quoted {{...}} and text"],
  ["O12#6", "C57#4", "F2 after Basic: a template / two quoted groups"],
  ["O12#6", "C57#5", "F2 after Basic: a template / a group and text, no quote"],
  ["O12#5", "C57#6", "F8 after Bearer: a template / a quoted ${...} and text"],
  ["O12#4", "C57#7", "F8 after Bearer: a template / a quoted <...> and text"],
  ["O12#5", "C57#8", "F8 after Bearer: a template / a quoted {{...}} and text"],
  ["O8#2", "C58#0", "F3: ${...} as the password / ${...} and text"],
  ["O8#3", "C58#1", "F3: <...> as the password / <...> and text"],
  ["O52#2", "C58#2", "F3: $(...) as the password / $(...) and text"],
  ["O8#2", "C58#3", "F3: a template password / {{...}} and text"],
  ["O8#2", "C58#4", "F3: one group / two groups in a row"],
  ["O8#2", "C58#5", "F3: a template password / ${{...}} and text"],
  ["O8#4", "C58#6", "F3: $NAME as the password / %NAME% and text"],
  ["O8#4", "C58#7", "F3: $NAME as the password / $NAME, a dot, text"],
  // Rework 08k (AP-110): the neighbours of the rules "a run", "one optional", "the whole
  // value", "starts with", "in any case", "only of".
  ...RUNS_AUTH.map((_, i) => [
    `O62#${i}`,
    `C59#${i}`,
    `F2: a run of white space #${i} after the colon: a template / a literal`,
  ]),
  ...RUNS_AUTH.map((_, i) => [
    `O63#${i}`,
    `C60#${i}`,
    `F2: a run of white space #${i} after the scheme: a template / a literal`,
  ]),
  ...RUNS_BEARER.map((_, i) => [
    `O64#${i}`,
    `C61#${i}`,
    `F8: a run of spaces and tabs #${i} after Bearer: a template / a literal`,
  ]),
  ...QUOTES3.flatMap((a, i) => [
    ...QUOTES3.map((_, j) => [
      `O65#${i * 3 + j}`,
      `C62#${i}`,
      `F9: two quotes after the name are no pair / one quote is (${a})`,
    ]),
    [
      `O65#${9 + i}`,
      `C62#${3 + i}`,
      `F9: two quotes before the colon are no pair / one quote is (${a})`,
    ],
  ]),
  ...QUOTES3.map((_, i) => [
    `O66#${i}`,
    `C63#${i}`,
    "F2: two opening quotes end the string, no scheme / one quote and the scheme",
  ]),
  ["O67#0", "C12#1", "F8: a capital letter on the left / none"],
  ["O67#1", "C64#0", "F8: a letter on the left / BEARER in capitals"],
  ["O67#2", "C64#2", "F8: a letter on the left / mixed case"],
  ["O12#4", "C64#1", "F8: a template / bEARER with a literal"],
  ...O69Pairs(),
  ...O70Pairs(),
  ...V3_WORDS.map((w, j) => [
    `O36#${j}`,
    `C67#${j}`,
    `V3: ${w} alone / a letter before it`,
  ]),
  ...SCHEMES.map((s, j) => [
    `O71#${j}`,
    `C68#${j}`,
    `F2: ${s} is a scheme word / a digit before it is not`,
  ]),
  ["O8#4", "C69#0", "Sh: $NAME as the password / a long $NAME, a dot, text"],
  ["O8#4", "C69#1", "Sh: $NAME as the password / a long %NAME%, text"],
  ...[0, 1, 2, 3, 4, 5].map((j) => [
    "O14#1",
    `C70#${j}`,
    "F9: a pair of quotes in a row is empty / a quotation of blanks is not",
  ]),
  ["O56#6", "C71#0", "B4: block characters only / three of them and a word"],
  ["O56#6", "C71#1", "B4: block characters only / three of them and a word"],
  ["O56#6", "C71#2", "B4: block characters only / three of them and a word"],
  ["O56#6", "C71#3", "B4: block characters only / eight of them and a letter"],
  ["O56#6", "C71#4", "B4: block characters only / a word and three of them"],
  ["O56#6", "C71#5", "B4: block characters only / a word and three of them"],
  ...[0, 1, 2, 3, 4, 5, 6].map((j) => [
    "O7#0",
    `C72#${j}`,
    "F1: exactly one space between BEGIN and CERTIFICATE / two spaces, a tab, a tab and a space, three, a no-break space, none",
  ]),
  ["O72#0", "C8#0", "F9: pwd is no name of the list / password is"],
  ["O72#1", "C8#0", "F9: api-key is no name of the list / password is"],
  [
    "O72#2",
    "C33#0",
    "F5: ghu_ is no prefix of the list / ghp_ and the same 20",
  ],
  ["O72#3", "C4#0", "F6: AIDA is no prefix of the list / AKIA and the same 16"],
  ["O73#0", "C73#0", "Z: pwd is on the list of placeholders / pw is not"],
  ["O73#1", "C73#1", "Z: pwd is on the list of placeholders / pw is not"],
  ["O73#2", "C73#2", "Z: pwd is on the list of placeholders / pw is not"],
  ["O73#3", "C73#3", "B3: bool is on the list of types / char is not"],
  ["O73#4", "C73#4", "Z: token is on the list of placeholders / tok is not"],
  ["O71#0", "C73#5", "F2: Basic is a scheme word / Hmac is not"],
];

// SWEEP-BEGIN
// ---- the sweeps by the class of a character (rework 08g, AP-110) ------------------------
//
// A rule of the requirement that is stated as "a character of the set ..." is tested for
// every character of a wide range, not for the few that the requirement names: one
// context with a slot for a character, and an expectation that comes from the set in the
// words of the requirement (a one-line membership test written here, not read from the
// code). A context is built so that the character in the slot is the only thing that
// decides between "stored" and "refused".
const CODES_ALL = [
  ...Array.from({ length: 128 }, (_, i) => i),
  ...[0x80, 0x84, 0x85, 0x86, 0x9f, 0xa1, 0xff, 0x167f, 0x180e, 0x1fff, 0x200b],
  ...[0x2027, 0x202a, 0x202e, 0x2030, 0x205e, 0x2060, 0x2fff, 0x3001, 0xfefe],
  ...[0xff00, 0xffff],
];
const CHARS_ALL = [
  ...new Set([...CODES_ALL.map((c) => String.fromCharCode(c)), ...WS]),
];
// For the sweeps that need many contexts: the printable characters and a few others.
const CHARS_PRINT = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(0x20 + i)),
  ...["\t", "\n", "\u0080", "\u00a0", "\u00ff", "\u2028", "\u3000"],
];
const ALNUM_CHARS = CHARS_PRINT.filter((c) => /^[A-Za-z0-9]$/u.test(c));
const QUOTE_CHARS = ["'", '"', "`"];
// The end of an unquoted value: white space, a quote, a comma, a semicolon.
const endsValue = (x) =>
  WS.includes(x) || QUOTE_CHARS.includes(x) || ",;".includes(x);
const isIdent = (x) => /^[A-Za-z_$]$/u.test(x); // class V1: letters, "_", "$", no digits
const isSegment = (x) => /^[A-Za-z0-9_-]$/u.test(x); // a segment of a name
const isAlnum = (x) => /^[A-Za-z0-9]$/u.test(x);
const isWord = (x) => /^[A-Za-z0-9_]$/u.test(x);
const isRun = (x) => /^[A-Za-z0-9_.-]$/u.test(x); // a run of F7
const isTokenEnd = (x) => /^[A-Za-z0-9_+=-]$/u.test(x); // the right side of F6
const isScheme = (x) => /^[A-Za-z0-9+.-]$/u.test(x); // the left of :// in F3

// A template is the WHOLE value (rework 08i, F1; AP-110): one slot for the character right
// after the group, in every place where a value is read. Where the value is a quotation
// the group is stored only when nothing but the closing quote follows it (or the line
// ends: a quotation that is not closed ends with its line); in the password of an
// address only when the password ends there (the next character is "@", and "/" or white
// space mean that the form does not apply at all); without quotes only when the value
// ends there. $NAME is the one group that has no closer: a letter, a digit or "_" next to
// it belongs to the name. The classes B1-B4 do not apply in quotes or to the password of
// an address, so "$A.x" is text after the name there. Without quotes "$(" opens a call
// (class B2, "the rest does not matter"), so $(...) has no unquoted sweep.
const TEMPLATE_KINDS = [
  ["dbrace", "${A}", false],
  ["dbrace2", "${{A}}", false],
  ["brace2", "{{A}}", false],
  ["dparen", "$(A)", false],
  ["angle", "<A>", false],
  ["pct", "%A%", false],
  ["dname", "$A", true],
];
const TEMPLATE_QUOTED = [
  ["pair", "password: ", '"'],
  ["pair", "password: ", "'"],
  ["pair", "password: ", "`"],
  ["scheme", "Authorization: " + BASIC + " ", '"'],
  ["bearer", "Bearer ", "'"],
];
const TEMPLATE_SWEEPS = [
  ...TEMPLATE_QUOTED.flatMap(([place, prefix, q]) =>
    TEMPLATE_KINDS.map(([kind, group, isName]) => [
      `G${place}${q.charCodeAt(0)}${kind}`,
      `Sh: in a quotation after ${place}, a ${kind} group is the whole content only when the closing quote or the end of the line follows it`,
      CHARS_ALL,
      (x) => prefix + q + group + x + "y" + q,
      (x) => x === q || LINE_ENDS.includes(x) || (isName && isWord(x)),
    ]),
  ),
  ...TEMPLATE_KINDS.map(([kind, group, isName]) => [
    `Gaddr${kind}`,
    `Sh: as the password of an address, a ${kind} group is the whole password only when "@" follows it (a "/" or white space: no address)`,
    CHARS_ALL,
    (x) => "https://u:" + group + x + "y@h",
    (x) => WS.includes(x) || x === "/" || x === "@" || (isName && isWord(x)),
  ]),
  ...[
    ["scheme", "Authorization: " + BASIC + " "],
    ["bearer", "Bearer "],
  ].flatMap(([place, prefix]) =>
    TEMPLATE_KINDS.filter(
      ([kind, , isName]) => !isName && kind !== "dparen",
    ).map(([kind, group]) => [
      `Gunq${place}${kind}`,
      `Sh: without quotes after ${place}, a ${kind} group is the whole value only when white space, a quote, a comma or a semicolon follows it`,
      CHARS_ALL,
      (x) => prefix + group + x + "y",
      endsValue,
    ]),
  ),
];

// The same class sweep with a LONG name template (rework 08k): a name template is the whole
// value, not its first few characters. Two places only: a quotation after a name and the
// password of an address.
const TEMPLATE_LONG = [
  ["dnameL", "$ABCDEFGHI", true],
  ["pctL", "%ABCDEFGHI%", false],
];
const TEMPLATE_LONG_SWEEPS = [
  ...TEMPLATE_LONG.map(([kind, group, isName]) => [
    `GpairL${kind}`,
    `Sh: in a quotation after a name, a long ${kind} group is the whole content only when the closing quote or the end of the line follows it`,
    CHARS_ALL,
    (x) => 'password: "' + group + x + 'y"',
    (x) => x === '"' || LINE_ENDS.includes(x) || (isName && isWord(x)),
  ]),
  ...TEMPLATE_LONG.map(([kind, group, isName]) => [
    `GaddrL${kind}`,
    `Sh: as the password of an address, a long ${kind} group is the whole password only when "@" follows it`,
    CHARS_ALL,
    (x) => "https://u:" + group + x + "y@h",
    (x) => WS.includes(x) || x === "/" || x === "@" || (isName && isWord(x)),
  ]),
];

// ---- rework 08k (AP-110): the neighbours of "starts with", "the whole value", "a run",
// "any case". One slot per context; the expectation is a one-line set written here from the
// words of the requirement. The contexts are the places where a value is read.
const isBlockChar = (x) => "{[(|>".includes(x);
// [id, text before the value, text after it, kind of place, the quote of the place]
const SLOT_PLACES = [
  ["u", "token=", "", "unquoted", ""],
  ...QUOTES3.map((q) => [
    `q${q.charCodeAt(0)}`,
    "password: " + q,
    q,
    "quoted",
    q,
  ]),
  ["a", "https://u:", "@h", "address", ""],
  ["s", `Authorization: ${BASIC} `, "", "unquoted", ""],
  ["b", "Bearer ", "", "unquoted", ""],
  ["sq", `Authorization: ${BASIC} "`, '"', "after-quote", '"'],
  ["bq", "Bearer '", "'", "after-quote", "'"],
];
// The slot is the character right BEFORE the word "your". Where the value is read a
// character of the set [A-Za-z0-9_.-] in front makes it a literal (the value then does not
// START with your); a separator ends the value, so "your" is then a value of its own; "$"
// makes the name template $your9. In a quotation only the closing quote (or a line end,
// which ends an unclosed quotation) puts the word into a value of its own.
const YOUR_BEFORE_SWEEPS = SLOT_PLACES.map(([id, before, after, kind, q]) => [
  `Yb${id}`,
  `Z: a character before your - ${kind} - a value STARTS with your (a letter, a digit, _ . - before it make a literal, a separator ends the value)`,
  CHARS_ALL,
  (x) => before + x + "your9" + after,
  kind === "unquoted"
    ? (x) => endsValue(x) || x === "$"
    : kind === "quoted"
      ? (x) => x === q || LINE_ENDS.includes(x) || x === "$"
      : kind === "after-quote"
        ? // a quote after a scheme or Bearer that is followed by white space is the
          // closing quote of a string: there is no value at all (F2, F8)
          (x) => WS.includes(x) || x === q || x === "$"
        : (x) => WS.includes(x) || x === "/" || x === "@" || x === "$",
]);
// The slot is the character right AFTER a chain of x, X, * (three characters): the chain is
// the WHOLE value, so any character that continues the value makes a literal; a call
// "xxx(" is an expression (class V2, not in quotes and not in an address).
const CHAIN_AFTER_SWEEPS = [
  ...SLOT_PLACES.map((place) => ["xxx", place]),
  ...["***", "XXX"].flatMap((chain) =>
    SLOT_PLACES.filter(([id]) => ["u", "q34", "a"].includes(id)).map(
      (place) => [chain, place],
    ),
  ),
].map(([chain, [id, before, after, kind, q]]) => [
  `Ch${chain.charCodeAt(0)}${id}`,
  `Z: a chain of x, X, * is the WHOLE value (${chain}, ${kind}): a character that continues the value makes a literal`,
  CHARS_ALL,
  (x) => before + chain + x + "9" + after,
  kind === "unquoted"
    ? // "xxx(" is a call (class V2: an identifier and "("); "***(" is not
      (x) => endsValue(x) || (x === "(" && chain !== "***")
    : kind === "quoted" || kind === "after-quote"
      ? (x) => x === q || LINE_ENDS.includes(x)
      : (x) => WS.includes(x) || x === "/" || x === "@",
]);
// A run of white space (rework 08k, F2): after the colon of Authorization and after the
// scheme word EVERY member of the closed set is skipped, however many in a row; a line end
// stops the value (the value of the next line is not taken). Two and three slots.
const WS_PAIRS = WS.flatMap((x) => WS.map((y) => x + y));
const TRIPLE_SET = [" ", "\t", ws(0xa0), ws(0x3000), "\n"];
const WS_TRIPLES = TRIPLE_SET.flatMap((x) =>
  TRIPLE_SET.flatMap((y) => TRIPLE_SET.map((z) => x + y + z)),
);
const hasLineEnd = (run) => [...run].some((c) => LINE_ENDS.includes(c));
const isSpaceTab = (c) => c === " " || c === "\t";
const WS_RUN_SWEEPS = [
  [
    "T3",
    "F2: a RUN of two white-space characters after the colon of Authorization is skipped (a line end stops it)",
    WS_PAIRS,
    (x) => "Authorization:" + x + PW,
    hasLineEnd,
  ],
  [
    "T4",
    "F2: a RUN of two white-space characters after the scheme word is skipped (a line end stops it)",
    WS_PAIRS,
    (x) => `Authorization: ${BASIC}` + x + PW,
    hasLineEnd,
  ],
  [
    "T5",
    "F2: a RUN of three white-space characters after the colon of Authorization is skipped",
    WS_TRIPLES,
    (x) => "Authorization:" + x + PW,
    hasLineEnd,
  ],
  [
    "T6",
    "F2: a RUN of three white-space characters after the scheme word is skipped",
    WS_TRIPLES,
    (x) => `Authorization: ${BASIC}` + x + PW,
    hasLineEnd,
  ],
  [
    "T7",
    "F8: after the word Bearer one or several SPACES AND TABS are skipped (any other white space ends it)",
    WS_PAIRS,
    (x) => "Bearer" + x + "abc1234",
    (x) => ![...x].every(isSpaceTab),
  ],
  [
    "T8",
    "F8: after the word Bearer three spaces and tabs in a row are skipped",
    WS_TRIPLES,
    (x) => "Bearer" + x + "abc1234",
    (x) => ![...x].every(isSpaceTab),
  ],
];
// B4: a value of the characters { [ ( | > only; one other character, in front or behind,
// makes a literal (the first characters or the last ones are not the value).
const BLOCK_RUN = "{[(|>{[(";
const BLOCK_SWEEPS = [
  [
    "B4a",
    "B4: seven block characters and then one character - the value is block characters only",
    CHARS_ALL,
    (x) => "token: " + BLOCK_RUN + x,
    (x) => isBlockChar(x) || endsValue(x),
  ],
  [
    "B4b",
    "B4: one character and then seven block characters - the value is block characters only",
    CHARS_ALL,
    (x) => "token: " + x + BLOCK_RUN,
    // first in the value, a quote OPENS a string (whose content is a literal)
    (x) => isBlockChar(x) || (endsValue(x) && !QUOTE_CHARS.includes(x)),
  ],
];

// ---- words in any case (rework 08k, F3; AP-110): every word that the requirement writes
// "without regard to case" is held in lower case, in capitals, capitalised, in two
// alternating cases, and with one letter replaced by a digit (a word that is not the
// word). A word that the requirement writes in ONE case (a prefix of a key, eyJ, the
// marker of a PEM block) is refused only in that case.
const caseVariants = (word) => {
  const cap = word[0].toUpperCase() + word.slice(1);
  const alt1 = [...word].map((c, k) => (k % 2 ? c.toUpperCase() : c)).join("");
  const alt2 = [...word].map((c, k) => (k % 2 ? c : c.toUpperCase())).join("");
  const out = new Set([
    word,
    word.toLowerCase(),
    word.toUpperCase(),
    cap,
    alt1,
    alt2,
  ]);
  [...word].forEach((c, k) =>
    out.add(word.slice(0, k) + "9" + word.slice(k + 1)),
  );
  return [...out];
};
const uniq = (list) => [...new Set(list)];
const hump = (x) => /[a-z][A-Z]/u.test(x); // class V3: a lower-case letter before a capital
const NAMES7 = [
  "token",
  "secret",
  "password",
  "passwd",
  "api_key",
  "apikey",
  "authorization",
];
const PH26 = [
  "password",
  "passwd",
  "pass",
  "pwd",
  "secret",
  "token",
  "key",
  "changeme",
  "change-me",
  "change_me",
  "changeit",
  "example",
  "sample",
  "placeholder",
  "dummy",
  "demo",
  "test",
  "admin",
  "root",
  "user",
  "guest",
  "postgres",
  "mysql",
  "none",
  "null",
  "undefined",
];
const CASE_SWEEPS = [
  [
    "CB",
    "F8: the word Bearer is read in any case",
    caseVariants("bearer"),
    (x) => x + " abc1234",
    (x) => x.toLowerCase() !== "bearer",
  ],
  ...["", "DB_"].map((left) => [
    `CN${left ? "p" : ""}`,
    `F9/F2: the names token, secret, password, passwd, api_key, apikey, authorization are read in any case${left ? " (after DB_)" : ""}`,
    uniq(NAMES7.flatMap(caseVariants)),
    (x) => left + x + "=hunter2fake",
    (x) => !NAMES7.includes(x.toLowerCase()),
  ]),
  [
    "CS",
    "F2: the nine scheme words are read in any case (a word that is no scheme is the value; a bare name is an expression)",
    uniq(SCHEMES.flatMap((w) => caseVariants(w.toLowerCase()))),
    (x) => "Authorization: " + x + " ${cred}",
    (x) => SCHEMES.some((w) => w.toLowerCase() === x.toLowerCase()) || hump(x),
  ],
  [
    "CWq",
    "Z: the 26 words of the list are placeholders in any case (in a quotation)",
    uniq(PH26.flatMap(caseVariants)),
    (x) => "password: '" + x + "'",
    (x) => PH26.includes(x.toLowerCase()),
  ],
  [
    "CWa",
    "Z: the 26 words of the list are placeholders in any case (the password of an address)",
    uniq(PH26.flatMap(caseVariants)),
    (x) => "https://u:" + x + "@h",
    (x) => PH26.includes(x.toLowerCase()),
  ],
  ...["q", "a"].flatMap((place) => [
    [
      `CY${place}`,
      "Z: a value that starts with your (any case) and is made of [A-Za-z0-9_.-] is a placeholder",
      caseVariants("your"),
      place === "q"
        ? (x) => "password: '" + x + "9'"
        : (x) => "https://u:" + x + "9@h",
      (x) => x.toLowerCase() === "your",
    ],
    [
      `CE${place}`,
      "Z: a value with example (any case) in it, made of [A-Za-z0-9_.-], is a placeholder",
      caseVariants("example"),
      place === "q"
        ? (x) => "password: 'a" + x + "9'"
        : (x) => "https://u:a" + x + "9@h",
      (x) => x.toLowerCase() === "example",
    ],
  ]),
  [
    "CK",
    "V3: the 26 words of types and keywords are bare names in any case (a name with a lower-case letter before a capital is a bare name anyway)",
    uniq(V3_WORDS.flatMap(caseVariants)),
    (x) => "token: " + x,
    (x) => V3_WORDS.includes(x.toLowerCase()) || hump(x),
  ],
  // the words that the requirement writes in ONE case
  [
    "CXsk",
    "F4: the prefix sk- is read in one case only",
    caseVariants("sk-"),
    (x) => x + N(20),
    (x) => x !== "sk-",
  ],
  [
    "CXgh",
    "F5: the prefixes ghp_, gho_, ghs_ are read in one case only",
    uniq(["ghp_", "gho_", "ghs_"].flatMap(caseVariants)),
    (x) => x + N(36),
    (x) => !["ghp_", "gho_", "ghs_"].includes(x),
  ],
  [
    "CXpat",
    "F5: the prefix github_pat_ is read in one case only",
    caseVariants("github_pat_"),
    (x) => x + N(22),
    (x) => x !== "github_pat_",
  ],
  [
    "CXak",
    "F6: the prefixes AKIA and ASIA are read in capitals only",
    uniq(["AKIA", "ASIA"].flatMap(caseVariants)),
    (x) => x + U(16),
    (x) => !["AKIA", "ASIA"].includes(x),
  ],
  [
    "CXjwt",
    "F7: a token starts with eyJ in this case only",
    caseVariants("eyJ"),
    (x) => x + ".a.b",
    (x) => x !== "eyJ",
  ],
  [
    "CXpem",
    "F1: the marker of a block is -----BEGIN in capitals only",
    caseVariants("-----BEGIN"),
    (x) => x + " PRIVATE KEY-----",
    (x) => x !== "-----BEGIN",
  ],
  [
    "CXcert",
    "F1: the label of the one stored header is CERTIFICATE in capitals only",
    caseVariants("CERTIFICATE"),
    (x) => "-----BEGIN " + x + "-----",
    (x) => x === "CERTIFICATE",
  ],
];

// X-BEGIN
// ---- rework 08m (AP-110): the EXHAUSTIVE SLOT RULE ---------------------------------------
//
// Five reworks found, one by one, the neighbours of rules that no row told apart. This
// one closes the class at once: for EVERY position of the requirement text where a
// set of characters, a closed list of words, a count (at least n, at most n, exactly
// n, a run) or a boundary is named, a sweep puts into the slot ALL 128 ASCII
// characters and a fixed set of others (a letter outside ASCII, a non-breaking space
// and the rest of the closed white space, a zero-width space, the full-width form of a
// letter and of a digit, an astral character), in front of the item, behind it, and
// inside it where the rule allows a run. The expected side is NOT read from the code:
// it comes from the reference below, a reading of the DEFINITIONS of the requirement
// (the value in quotes, the value without quotes, the classes Z, Sh, B1-B4) written
// here as a predicate over a value. A word list is swept word by word, each word with
// every letter in the other case and with every word just outside the list (a letter
// off); a count is tested at n-1, n and n+1.
//
// The table of the positions is in the report of the step (result.summary of
// step-08m): rule, position, set, slot width.
//
// The positions where the requirement is SILENT and the reference follows the code's
// predecessor (rework 08o; remarks F1, F2 of 08n). A reader must not take them for the
// words of the requirement:
//  (1) F4-F6 «слева не буква и не цифра»: the reference reads «letter» and «digit» as
//      ASCII [A-Za-z0-9] (the old rules M4-M6, tools/src/pixel-office/mask.js). A letter
//      or a digit outside ASCII to the left of a key counts as a boundary, so the key is
//      refused: this is the safe side.
//  (2) F5 «не менее 20 знаков»: the requirement gives no set of characters for the body.
//      The reference keeps the sets of the old rules M5 and M6: [A-Za-z0-9] after
//      ghp_, gho_, ghs_ and [A-Za-z0-9_] after github_pat_. That is the predecessor's
//      reading, not the requirement's: a wider set would refuse more, so this one is NOT
//      the strictest reading and is held only as «as before».
//  (3) F3 «@хост»: the host has no definition; an address with a real password is
//      refused whatever stands behind the at sign (even nothing).
//  (4) A value that is not a string (the guard at the end of findSecrets) is no rule of
//      the requirement.
// The dot to the left of eyJ in F7 is NOT among them (it was, wrongly, at 08m): the run
// is made of [A-Za-z0-9_.-] and a dot belongs to it, so x.eyJ..., .eyJ... and
// a.b.eyJ... have four or more parts and are stored (O32, the sweeps XJ1 and J1).
// a letter outside ASCII (two), the full-width forms of a letter and of a digit, an astral
// character, and the typographic quotes (a guillemet and a curly quote are no quote)
const X_EXTRA = [
  0xe9, 0xdf, 0xff21, 0xff41, 0xff10, 0x1f600, 0xab, 0xbb, 0x2018, 0x2019,
  0x201c, 0x201d,
].map((c) => String.fromCodePoint(c));
const CHARS_X = [...new Set([...CHARS_ALL, ...X_EXTRA])];
const lowA = (s) =>
  s.replace(/[A-Z]/gu, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
const isHws = (c) => WS.includes(c) && !LINE_ENDS.includes(c);
const SCHEMES_LOW = SCHEMES.map((w) => w.toLowerCase());

// -- the reference: classes of a value, from the words of the requirement --
// Z (placeholder): the whole value is one of the 26 words (any case), or a chain of at
// least 3 characters only of * x X, or - only for a value made of [A-Za-z0-9_.-] - it
// starts with your or contains example (any case).
const refPlaceholder = (v) => {
  const low = lowA(v);
  return (
    PH26.includes(low) ||
    (v.length >= 3 && /^[*xX]+$/u.test(v)) ||
    (/^[A-Za-z0-9_.-]+$/u.test(v) &&
      (low.startsWith("your") || low.includes("example")))
  );
};
// Sh (template): $NAME or %NAME%, NAME = [A-Za-z_][A-Za-z0-9_]*
const refNameTemplate = (v) =>
  /^(?:\$[A-Za-z_][A-Za-z0-9_]*|%[A-Za-z_][A-Za-z0-9_]*%)$/u.test(v);
// Sh (group): ${...} to the first }, ${{...}} to }}, {{...}} to }}, $(...) to the first
// ), <...> to the first > with no < inside; not empty, one line. The end of the group
// that starts s, or -1.
function refGroupEnd(s) {
  const upto = (from, closer, noOpen) => {
    for (let j = from; j < s.length; j += 1) {
      if (LINE_ENDS.includes(s[j])) return -1;
      if (noOpen && s[j] === "<") return -1;
      if (s.startsWith(closer, j)) return j === from ? -1 : j + closer.length;
    }
    return -1;
  };
  if (s.startsWith("${{")) return upto(3, "}}", false);
  if (s.startsWith("${")) return upto(2, "}", false);
  if (s.startsWith("{{")) return upto(2, "}}", false);
  if (s.startsWith("$(")) return upto(2, ")", false);
  if (s.startsWith("<")) return upto(1, ">", true);
  return -1;
}
const refGroup = (v) => v !== "" && refGroupEnd(v) === v.length;
// B1 path, B2 call, B3 bare identifier, B4 block (the value without quotes only)
const refPath = (v) => /^[A-Za-z_$]+(?:\??\.[A-Za-z_$]+)+$/u.test(v);
const refCall = (v) => /^[A-Za-z_$]+(?:\??\.[A-Za-z_$]+)*\(/u.test(v);
const refBare = (v) =>
  /^[A-Za-z_]+$/u.test(v) &&
  ((v.includes("_") && /[A-Za-z]/u.test(v)) ||
    /[a-z][A-Z]/u.test(v) ||
    V3_WORDS.includes(lowA(v)));
const refBlock = (v) => /^[{[(|>]+$/u.test(v);
// the closers at the end are dropped by count, not by pair
function refDropClosers(v) {
  let s = v;
  for (;;) {
    const last = s[s.length - 1];
    const open = { ")": "(", "]": "[", "}": "{" }[last];
    if (open === undefined) return s;
    const n = (c) => s.split(c).length - 1;
    if (n(last) <= n(open)) return s;
    s = s.slice(0, -1);
  }
}
const refIsEnder = (c) =>
  WS.includes(c) || QUOTE_CHARS.includes(c) || c === "," || c === ";";
// the value without quotes that starts s: none | keep | literal
function refUnquoted(s, bare) {
  const g = refGroupEnd(s);
  let end = g === -1 ? 0 : g;
  while (end < s.length && !refIsEnder(s[end])) end += 1;
  const v = end === 0 ? "" : refDropClosers(s.slice(0, end));
  if (v === "") return "none";
  const keep =
    (g !== -1 && v.length === g) ||
    refPlaceholder(v) ||
    refNameTemplate(v) ||
    refPath(v) ||
    refCall(v) ||
    (bare && refBare(v)) ||
    refBlock(v);
  return keep ? "keep" : "literal";
}
// the value in quotes that starts s (s[0] is the quote): from the opening quote to the
// same quote on the same line; a backslash escapes the next character unless that is a
// line end; without a closing quote to the end of the line or of the text. Empty: none.
// Inside the quotes only Z and Sh count (no B1-B4).
function refQuoted(s) {
  const q = s[0];
  let i = 1;
  while (i < s.length) {
    const c = s[i];
    if (LINE_ENDS.includes(c)) break;
    if (c === "\\" && i + 1 < s.length && !LINE_ENDS.includes(s[i + 1])) {
      i += 2;
    } else if (c === q) {
      break;
    } else {
      i += 1;
    }
  }
  const content = s.slice(1, i);
  if (content === "") return "none";
  return refPlaceholder(content) ||
    refNameTemplate(content) ||
    refGroup(content)
    ? "keep"
    : "literal";
}
const skipOf = (s, isSkipped) => {
  let k = 0;
  while (k < s.length && isSkipped(s[k])) k += 1;
  return s.slice(k);
};
// the value after a scheme word or after Bearer, from the first character: a line end
// or the end is no value; a quote followed by white space or the end is the closing
// quote of a string (no value); a quotation; the first word (B3 does not apply)
function refAfterWord(s) {
  if (s === "" || LINE_ENDS.includes(s[0])) return "none";
  if (QUOTE_CHARS.includes(s[0]) && (s.length === 1 || WS.includes(s[1]))) {
    return "none";
  }
  return QUOTE_CHARS.includes(s[0]) ? refQuoted(s) : refUnquoted(s, false);
}
// F2: what follows "Authorization:" (after the sign): white space (not a line end), one
// optional opening quote, an optional scheme word of the closed list (any case), the
// same white space; then the value
function refAuth(s0) {
  const s = skipOf(s0, isHws);
  const rest = QUOTE_CHARS.includes(s[0] ?? "") ? s.slice(1) : s;
  let e = 0;
  while (
    e < rest.length &&
    !WS.includes(rest[e]) &&
    !QUOTE_CHARS.includes(rest[e])
  ) {
    e += 1;
  }
  if (e >= 3 && e <= 9 && SCHEMES_LOW.includes(lowA(rest.slice(0, e)))) {
    return refAfterWord(skipOf(rest.slice(e), isHws));
  }
  if (s === "" || LINE_ENDS.includes(s[0])) return "none";
  return QUOTE_CHARS.includes(s[0]) ? refQuoted(s) : refUnquoted(s, true);
}
// F3: the password of scheme://user:password@host, up to / @ or white space
function refPassword(v) {
  const s = v + "@h";
  let k = 0;
  while (k < s.length && s[k] !== "/" && s[k] !== "@" && !WS.includes(s[k])) {
    k += 1;
  }
  if (k === 0 || s[k] !== "@") return "none";
  const pw = s.slice(0, k);
  return refPlaceholder(pw) || refNameTemplate(pw) || refGroup(pw)
    ? "keep"
    : "literal";
}
// the places where a value is read: the text around it and the reading
const VALUE_PLACES = {
  // a pair name=value: spaces and tabs are skipped; B3 applies
  u: [
    (v) => "token=" + v,
    (v) => {
      const s = skipOf(v, (c) => c === " " || c === "\t");
      if (s === "" || LINE_ENDS.includes(s[0])) return "none";
      return QUOTE_CHARS.includes(s[0]) ? refQuoted(s) : refUnquoted(s, true);
    },
  ],
  // the content of a quotation (the three kinds of quote)
  ...Object.fromEntries(
    QUOTE_CHARS.map((q) => [
      `q${q.charCodeAt(0)}`,
      [(v) => `password: ${q}${v}${q}`, (v) => refQuoted(q + v + q)],
    ]),
  ),
  // the password of an address
  a: [(v) => "https://u:" + v + "@h", refPassword],
  // after a scheme word: white space skipped; B3 does not apply
  s: [
    (v) => `Authorization: ${BASIC} ` + v,
    (v) => refAfterWord(skipOf(v, isHws)),
  ],
  // after Bearer: spaces and tabs are skipped; B3 does not apply
  b: [
    (v) => "Bearer " + v,
    (v) => refAfterWord(skipOf(v, (c) => c === " " || c === "\t")),
  ],
  // after the colon of Authorization: the whole rule of F2
  au: [(v) => "Authorization: " + v, refAuth],
};
// a sweep over values: the text is put into the place, stored is "not a literal"
const valueSweep = (id, rule, place, values) => [
  id,
  rule,
  values,
  VALUE_PLACES[place][0],
  (v) => VALUE_PLACES[place][1](v) !== "literal",
];
// the slot around an item: [left, right] pairs make left + x + right for every x
const around = (left, right) => CHARS_X.map((x) => left + x + right);
const beforeAfter = (w) => [...around("", w), ...around(w, "")];
// one stored and one refused control row for the sweeps whose slot cannot show both
const CTRL = ["root", PW];
const uniqList = (list) => [...new Set(list)];

// -- the lists of words with their letters: every letter in the other case, every word
// a letter off (a letter dropped, a letter put in, a letter replaced), a slot inside --
const otherCase = (c) =>
  c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
const flips = (w) =>
  [...w].flatMap((c, k) =>
    otherCase(c) === c ? [] : [w.slice(0, k) + otherCase(c) + w.slice(k + 1)],
  );
const drops = (w) => [...w].map((_, k) => w.slice(0, k) + w.slice(k + 1));
const puts = (w) =>
  Array.from(
    { length: w.length + 1 },
    (_, k) => w.slice(0, k) + "q" + w.slice(k),
  );
const swaps = (w) =>
  [...w].map(
    (c, k) => w.slice(0, k) + (c === "q" ? "z" : "q") + w.slice(k + 1),
  );
const neighbours = (w) =>
  uniqList([...flips(w), ...drops(w), ...puts(w), ...swaps(w)]);
// the slot inside a word: each place in turn, for every character
const inside = (w) =>
  Array.from({ length: w.length - 1 }, (_, k) => k + 1).flatMap((k) =>
    around(w.slice(0, k), w.slice(k)),
  );

// a sentinel for a sweep whose slot cannot show the stored side: one row that is a stored text
const STORED_CTRL = "\u0000stored";

// -- the items that stand in the slots of the value places --
// Z, the closed list of 26 words: each word with the slot before and after it.
const X_PH_PLACES = ["u", "q34", "a", "s", "b"];
// Z, your and example: a prefix test and a "contains" test, each one before, after and
// inside (a slot in the middle of the word, and between two parts of one run).
const X_YOUR_ITEMS = [
  ...beforeAfter("your"),
  ...beforeAfter("example"),
  ...around("yo", "ur"),
  ...around("exa", "mple"),
  ...around("your", "key"),
  ...around("pw", "example"),
  ...around("example", "pw"),
  ...around("YOUR", "_API_KEY"),
  ...CTRL,
];
// Z, the chain of * x X: every string over the three characters up to length 4 (the
// counts 1, 2, 3, 4 around the minimum 3), single-character runs up to 7, and the slot
// before, after and inside a chain of three.
const CHAIN_SET = ["*", "x", "X"];
const chainsTo = (n) =>
  n === 0
    ? [""]
    : chainsTo(n - 1).flatMap((head) => CHAIN_SET.map((c) => head + c));
const X_CHAIN_ITEMS = [
  ...[1, 2, 3, 4].flatMap(chainsTo),
  ...CHAIN_SET.map((c) => c.repeat(7)),
  ...["xxx", "***", "XXX", "x*X"].flatMap(beforeAfter),
  ...around("xx", "xx"),
  ...around("*", "**"),
  ...around("**", "*"),
  ...CTRL,
];
// Sh and B1-B4: the pieces of a path, a call, a bare identifier, a name template, a
// block, and a group, each with the slot between its parts
const X_EXPR_ITEMS = [
  ...around("a", ".b"),
  ...around("a.", "b"),
  ...around("a.b", ""),
  ...around("", "a.b"),
  ...around("a?", ".b"),
  ...around("a", "?.b"),
  ...around("a.b", ".c"),
  ...around("a", "(x)"),
  ...around("f(", ")"),
  ...around("a.b", "("),
  ...around("a", "B"),
  ...around("", "aB"),
  ...around("_", "a"),
  ...around("a", "_"),
  ...around("A", "a"),
  ...around("$", "OKEN"),
  ...around("$T", "OKEN"),
  ...around("$TOKE", ""),
  ...around("%", "OKEN%"),
  ...around("%T", "OKEN%"),
  ...around("%TOKEN", "%"),
  ...around("%TOKEN%", ""),
  ...around("${", "}"),
  ...around("${{", "}}"),
  ...around("{{", "}}"),
  ...around("$(", ")"),
  ...around("<", ">"),
  ...around("${A", "}"),
  ...around("${A}", ""),
  ...around("", "${A}"),
  ...around("{{A}", "}"),
  ...around("<A", ">"),
  ...around("{[(", "|>"),
  ...around("{[(|>", ""),
  ...around("", "{[(|>"),
  ...CTRL,
];
// B3, the list of 26 types and keywords: each word before and after it (the position
// where B3 applies: a pair); after a scheme and after Bearer B3 does not apply
const X_V3_ITEMS = [...V3_WORDS.flatMap(beforeAfter), ...CTRL];
// a literal value with the slot before it and after it (the character after the sign,
// after a scheme, after Bearer, after the opening quote, after the colon of a password)
const X_PW_ITEMS = [...beforeAfter(PW), "root"];
// runs of white space in front of the value: over the members of the closed set that
// differ in what they do (space, tab, no-break space, line end), up to three
const runsOf = (set, n) =>
  n === 0 ? [""] : runsOf(set, n - 1).flatMap((h) => set.map((c) => h + c));
const X_RUNS_SPTAB = [0, 1, 2, 3].flatMap((n) =>
  runsOf([" ", "\t", ws(0xa0)], n),
);
const X_RUNS_HWS = [0, 1, 2, 3].flatMap((n) =>
  runsOf([" ", "\t", ws(0xa0), "\n"], n),
);

// the closers at the end of a value are dropped by count (not by pair): a base with
// openers or without, then up to three closers of the three kinds in every order
const CLOSER_BASES = [
  "root",
  "a.b",
  "f(x",
  "f(",
  "(x",
  "[x",
  "{x",
  "x[y",
  "x{y",
  "${A",
  "${A}",
  "{{A}",
  "a(b",
  "$(A",
  "<A>",
];
const X_CLOSER_ITEMS = [
  ...CLOSER_BASES.flatMap((base) =>
    [0, 1, 2, 3].flatMap((n) =>
      runsOf([")", "]", "}"], n).map((closers) => base + closers),
    ),
  ),
  ...CTRL,
];
// the words just outside the lists: every letter in the other case, a letter dropped,
// put in or replaced
const X_NEIGH_PH = uniqList([...PH26, "your", "example"].flatMap(neighbours));
const X_NEIGH_V3 = uniqList(V3_WORDS.flatMap(neighbours));

const X_VALUE_SWEEPS = [
  ...X_PH_PLACES.map((place) =>
    valueSweep(
      `XW${place}`,
      `Z: the 26 words of the list are the whole value - a character before or behind a word makes it another value (${place})`,
      place,
      [...PH26.flatMap(beforeAfter), ...CTRL],
    ),
  ),
  ...["u", "q39", "q34", "q96", "a", "s", "b"].flatMap((place) => [
    valueSweep(
      `XY${place}`,
      `Z: your at the start and example anywhere, only in a value of [A-Za-z0-9_.-] (${place})`,
      place,
      X_YOUR_ITEMS,
    ),
    valueSweep(
      `XC${place}`,
      `Z: a chain of at least 3 characters only of * x X is the whole value (${place})`,
      place,
      X_CHAIN_ITEMS,
    ),
  ]),
  ...["u", "q34", "a", "s", "b"].map((place) =>
    valueSweep(
      `XE${place}`,
      `Sh and B1-B4: the parts of a path, a call, a bare name, a template, a block (${place})`,
      place,
      X_EXPR_ITEMS,
    ),
  ),
  valueSweep(
    "XVu",
    "B3: each of the 26 words of types and keywords, with a slot before and behind it (a pair)",
    "u",
    X_V3_ITEMS,
  ),
  ...["s", "b"].map((place) =>
    valueSweep(
      `XV${place}`,
      `B3 does not apply after a scheme and after Bearer: the 26 words (every casing) are literals (${place})`,
      place,
      [...uniqList(V3_WORDS.flatMap(caseVariants)), ...CTRL],
    ),
  ),
  ...["u", "q34", "a", "s", "b"].map((place) =>
    valueSweep(
      `XP${place}`,
      `a literal with a slot before and behind it: which character before the value is skipped, which ends it (${place})`,
      place,
      X_PW_ITEMS,
    ),
  ),
  valueSweep(
    "XRu",
    "F9: after the sign only spaces and tabs are skipped, any number of them (any other white space ends the value)",
    "u",
    [...X_RUNS_SPTAB.map((r) => r + PW), ...CTRL],
  ),
  valueSweep(
    "XRs",
    "F2: after the scheme word the closed white set is skipped, any number of them (a line end stops)",
    "s",
    [...X_RUNS_HWS.map((r) => r + PW), ...CTRL],
  ),
  valueSweep(
    "XRb",
    "F8: after Bearer spaces and tabs are skipped, any number of them (any other white space ends the value)",
    "b",
    [...X_RUNS_HWS.map((r) => r + PW), ...CTRL],
  ),
  ...["u", "q34", "a", "s", "b"].flatMap((place) => [
    valueSweep(
      `XD${place}`,
      `the closers at the end of a value are dropped by count, not by pair (${place})`,
      place,
      X_CLOSER_ITEMS,
    ),
    valueSweep(
      `XO${place}`,
      `Z: a word of the 26 (or your, example) with a letter in the other case, dropped, put in or replaced (${place})`,
      place,
      [...X_NEIGH_PH, ...CTRL],
    ),
  ]),
  ...["u", "s"].map((place) =>
    valueSweep(
      `XM${place}`,
      `B3: a word of the 26 types and keywords with a letter in the other case, dropped, put in or replaced (${place})`,
      place,
      [...X_NEIGH_V3, ...CTRL],
    ),
  ),
];

// ---- F1: -----BEGIN and the one stored header ----
const CERT_BODY = "BEGIN CERTIFICATE";
const certLine = (l, gap, r) =>
  "-".repeat(l) + "BEGIN" + gap + "CERTIFICATE" + "-".repeat(r);
const DASH_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const X_GAPS = uniqList([
  "",
  ...CHARS_X,
  ...CHARS_X.map((x) => " " + x),
  ...CHARS_X.map((x) => x + " "),
  ...WS_PAIRS,
  ...WS_TRIPLES,
  "    ",
  "     ",
]);
const replaceAt = (w, k, x) => w.slice(0, k) + x + w.slice(k + 1);
const X_F1_SWEEPS = [
  [
    "XF1a",
    "F1: the character before the stored header - a dash makes six dashes (a refusal), any other character keeps the header",
    CHARS_X,
    (x) => x + "-----" + CERT_BODY + "-----",
    (x) => x !== "-",
  ],
  [
    "XF1b",
    "F1: the character after the stored header - a dash makes six dashes (a refusal), any other character keeps the header",
    CHARS_X,
    (x) => "-----" + CERT_BODY + "-----" + x,
    (x) => x !== "-",
  ],
  [
    "XF1c",
    "F1: between BEGIN and CERTIFICATE exactly ONE space (none, two, a tab, three, any other character, a space and a character)",
    X_GAPS,
    (g) => certLine(5, g, 5),
    (g) => g === " ",
  ],
  [
    "XF1d",
    "F1: five dashes on each side (4, 5, 6 and the counts around): fewer than five before BEGIN is no marker at all, more than five before or any other count behind is not the header",
    DASH_COUNTS.flatMap((l) => DASH_COUNTS.map((r) => [l, r])),
    ([l, r]) => certLine(l, " ", r),
    ([l, r]) => l < 5 || (l === 5 && r === 5),
  ],
  ...Array.from({ length: 5 }, (_, k) => [
    `XF1e${k}`,
    `F1: the letter ${k} of the word BEGIN is that letter in capitals (any other character, also its small form, is no marker)`,
    CHARS_X,
    (x) => "-----" + replaceAt("BEGIN", k, x) + " PRIVATE KEY-----",
    (x) => x !== "BEGIN"[k],
  ]),
  ...Array.from({ length: 5 }, (_, k) => [
    `XF1f${k}`,
    `F1: the dash ${k} of the five before BEGIN is a dash (any other character is no marker)`,
    CHARS_X,
    (x) => replaceAt("-----", k, x) + "BEGIN PRIVATE KEY-----",
    (x) => x !== "-",
  ]),
  ...Array.from({ length: 11 }, (_, k) => [
    `XF1g${k}`,
    `F1: the letter ${k} of CERTIFICATE is that capital letter (any other character is another label: a refusal)`,
    CHARS_X,
    (x) => "-----BEGIN " + replaceAt("CERTIFICATE", k, x) + "-----",
    (x) => x === "CERTIFICATE"[k],
  ]),
  [
    "XF1i",
    "F1: a second marker behind the stored header is found whatever stands between them",
    [...CHARS_X, STORED_CTRL],
    (x) =>
      x === STORED_CTRL
        ? "-----" + CERT_BODY + "-----"
        : "-----" +
          CERT_BODY +
          "-----" +
          x +
          "-----" +
          "BEGIN PRIVATE" +
          " KEY-----",
    (x) => x === STORED_CTRL,
  ],
  [
    "XF1h",
    "F1: a label of one letter more or less than CERTIFICATE is another label",
    [
      ...Array.from({ length: 12 }, (_, k) =>
        around("CERTIFICATE".slice(0, k), "CERTIFICATE".slice(k)),
      ).flat(),
      ...Array.from({ length: 11 }, (_, k) => [
        "CERTIFICATE".slice(0, k) + "CERTIFICATE".slice(k + 1),
      ]).flat(),
      "CERTIFICATE",
    ],
    (g) => "-----BEGIN " + g + "-----",
    (g) => g === "CERTIFICATE",
  ],
];

// ---- F3: scheme://user:password@host ----
const F3_PW = PW;
const isSchemeChar = (x) => /^[A-Za-z0-9+.-]$/u.test(x);
const X_F3_SWEEPS = [
  [
    "XU1",
    "F3: the character to the left of :// is one of [A-Za-z0-9+.-] (also: nothing to the left)",
    ["", ...CHARS_X],
    (x) => x + "://deploy:" + F3_PW + "@host/x",
    (x) => !isSchemeChar(x),
  ],
  [
    "XU2a",
    "F3: the first character of the user - white space, / and @ end the user, a colon leaves the user empty; the form then does not apply",
    CHARS_X,
    (x) => "https://" + x + "ser:" + F3_PW + "@host",
    (x) => WS.includes(x) || x === "/" || x === "@" || x === ":",
  ],
  [
    "XU2b",
    "F3: the last character of the user - white space, / and @ end the user before the colon, a colon is part of the password",
    CHARS_X,
    (x) => "https://use" + x + ":" + F3_PW + "@host",
    (x) => WS.includes(x) || x === "/" || x === "@",
  ],
  [
    "XU3",
    "F3: the character that separates the user and the password is a colon",
    CHARS_X,
    (x) => "https://deploy" + x + F3_PW + "@host",
    (x) => x !== ":",
  ],
  [
    "XU4",
    "F3: the character behind the password is an at sign",
    CHARS_X,
    (x) => "https://deploy:" + F3_PW + x + "host",
    (x) => x !== "@",
  ],
  [
    "XU5",
    "F3: the character that is the colon of ://",
    CHARS_X,
    (x) => "https" + x + "//deploy:" + F3_PW + "@host",
    (x) => x !== ":",
  ],
  [
    "XU6",
    "F3: the first slash of ://",
    CHARS_X,
    (x) => "https:" + x + "/deploy:" + F3_PW + "@host",
    (x) => x !== "/",
  ],
  [
    "XU7",
    "F3: the second slash of ://",
    CHARS_X,
    (x) => "https:/" + x + "deploy:" + F3_PW + "@host",
    (x) => x !== "/",
  ],
  [
    "XU8",
    "F3: the number of slashes after the colon is two (0, 1, 2, 3, 4)",
    [0, 1, 2, 3, 4],
    (n) => "https:" + "/".repeat(n) + "deploy:" + F3_PW + "@host",
    (n) => n !== 2,
  ],
  [
    "XU9",
    "F3: the number of characters of the user: none leaves the form out, one or more is a user",
    [0, 1, 2, 3, 20].map((n) => "a".repeat(n)),
    (u) => "https://" + u + ":" + F3_PW + "@host",
    (u) => u === "",
  ],
  [
    "XU10",
    "F3: the number of characters of the password: none leaves the form out, one or more is a password",
    [0, 1, 2, 3, 20].map((n) => "b".repeat(n)),
    (p) => "https://deploy:" + p + "@host",
    (p) => p === "",
  ],
];

// ---- F4-F6: keys with a known prefix ----
// the families: the prefixes that the requirement lists, the characters of the body, the
// minimum of the body and the text of a body of n characters
const KEY_FAMILIES = [
  {
    id: "sk",
    prefixes: ["sk-"],
    body: (x) => /^[A-Za-z0-9_-]$/u.test(x),
    min: 16,
    fill: (n) => N(n),
    exact: false,
  },
  {
    id: "gh",
    prefixes: [GHP, GHO, GHS],
    body: (x) => /^[A-Za-z0-9]$/u.test(x),
    min: 20,
    fill: (n) => N(n),
    exact: false,
  },
  {
    id: "pat",
    prefixes: [GHPAT],
    body: (x) => /^[A-Za-z0-9_]$/u.test(x),
    min: 20,
    fill: (n) => N(n),
    exact: false,
  },
  {
    id: "ak",
    prefixes: [AKIA, ASIA],
    body: (x) => /^[A-Z0-9]$/u.test(x),
    min: 16,
    fill: (n) => U(n),
    exact: true,
  },
];
const X_KEY_SWEEPS = KEY_FAMILIES.flatMap((fam) => {
  const first = fam.prefixes[0];
  return [
    // every character of every prefix: replaced by every character
    ...[...first].map((_, k) => [
      `XK${fam.id}p${k}`,
      `F4-F6: the character ${k} of the prefix ${fam.id} - another character is no prefix, unless it gives another prefix of the list`,
      CHARS_X,
      (x) => replaceAt(first, k, x) + fam.fill(fam.min),
      (x) => !fam.prefixes.includes(replaceAt(first, k, x)),
    ]),
    // the character to the left
    [
      `XK${fam.id}l`,
      `F4-F6: a letter or a digit to the left of the prefix ${fam.id} is no boundary`,
      CHARS_X,
      (x) => x + first + fam.fill(fam.min),
      isAlnum,
    ],
    // the count of the body: n-1, n, n+1 (and more) - at least n; for AKIA exactly 16
    [
      `XK${fam.id}n`,
      `F4-F6: the body of ${fam.id} has at least ${fam.min} characters${fam.exact ? " (exactly 16 and no body character to the right)" : ""}: ${fam.min - 2}, ${fam.min - 1}, ${fam.min}, ${fam.min + 1} and more`,
      [0, 1, fam.min - 2, fam.min - 1, fam.min, fam.min + 1, fam.min + 2, 40],
      (n) => first + fam.fill(n),
      (n) => (fam.exact ? n !== fam.min : n < fam.min),
    ],
    // the character at the first, the middle and the last place of the body
    ...["first", "middle", "last"].map((where) => [
      `XK${fam.id}b${where}`,
      `F4-F6: a character at the ${where} place of the body of ${fam.id}: only the characters of the set count`,
      CHARS_X,
      (x) => {
        const n = fam.min - 1;
        const head = where === "first" ? 0 : where === "middle" ? 8 : n;
        return first + fam.fill(n).slice(0, head) + x + fam.fill(n).slice(head);
      },
      (x) => !fam.body(x),
    ]),
    // the character after the minimum body: AKIA looks at it, the others do not
    [
      `XK${fam.id}r`,
      fam.exact
        ? "F6: the character to the right of the 16 characters - one of [A-Za-z0-9_+=-] means it is not a key"
        : `F4-F5: the character after the minimum body of ${fam.id} changes nothing (a key, whatever follows)`,
      ["", ...CHARS_X, STORED_CTRL],
      (x) =>
        x === STORED_CTRL ? first + "short" : first + fam.fill(fam.min) + x,
      fam.exact
        ? (x) => x === STORED_CTRL || isTokenEnd(x)
        : (x) => x === STORED_CTRL,
    ],
  ];
});

// ---- F7: a token that starts with eyJ and has exactly three non-empty parts ----
const isRunChar = (x) => /^[A-Za-z0-9_.-]$/u.test(x);
// the reference: a run of [A-Za-z0-9_.-] that starts with eyJ; dots at its end are
// punctuation; exactly three parts, none empty
const refJwt = (run) => {
  const body = run.replace(/\.+$/u, "");
  const parts = body.split(".");
  return parts.length === 3 && parts.every((p) => p !== "");
};
const partsSeq = (m) =>
  m === 0
    ? [[]]
    : partsSeq(m - 1).flatMap((head) => ["", "a"].map((p) => [...head, p]));
const DOT_PARTS = [1, 2, 3, 4, 5].flatMap(partsSeq);
const X_F7_SWEEPS = [
  [
    "XJ1",
    "F7: a character of [A-Za-z0-9_.-] to the left of eyJ - the dot too - means the run does not start with eyJ (x.eyJ... and .eyJ... have four parts: stored)",
    CHARS_X,
    (x) => x + JWT3,
    isRun,
  ],
  ...[0, 1, 2].map((k) => [
    `XJ2${k}`,
    `F7: the character ${k} of eyJ is that character (another one is no token; a small j or a capital E is not eyJ)`,
    CHARS_X,
    (x) =>
      replaceAt(EYJ, k, x) +
      "hbGciOiJIUzI1NiJ9.zdWIiOiJmYWtlIn0.ZmFrZXNpZ25hdHVyZQ",
    (x) => x !== EYJ[k],
  ]),
  [
    "XJ3",
    "F7: a character right after eyJ - a run character keeps the part, a dot ends the first part (eyJ.a.b is three parts), another character ends the run",
    CHARS_X,
    (x) => EYJ + x + "a.b.c",
    // the run continues for a run character: eyJxa.b.c is three parts; a dot gives
    // eyJ + "" + a.b.c = four parts; another character ends the run: no token
    (x) => !(isRunChar(x) && x !== "."),
  ],
  [
    "XJ4",
    "F7: the first separator - a dot gives three parts, another run character gives two, another character ends the run",
    CHARS_X,
    (x) => EYJ + "a" + x + "b.c",
    (x) => x !== ".",
  ],
  [
    "XJ5",
    "F7: the single character of the middle part - a run character other than a dot makes three parts, a dot makes an empty part, another character ends the run",
    CHARS_X,
    (x) => EYJ + "a." + x + ".c",
    (x) => !(isRunChar(x) && x !== "."),
  ],
  [
    "XJ6",
    "F7: the second separator - a dot gives three parts, another run character gives two",
    CHARS_X,
    (x) => EYJ + "a.b" + x + "c",
    (x) => x !== ".",
  ],
  [
    "XJ7",
    "F7: the single character of the last part - a run character other than a dot makes three parts, a dot is punctuation at the end (two parts), another character ends the run",
    CHARS_X,
    (x) => EYJ + "a.b." + x,
    (x) => !(isRunChar(x) && x !== "."),
  ],
  [
    "XJ8",
    "F7: a character right after the third part - a dot gives four parts when a part follows, punctuation when nothing follows; the counts of dots and empty parts 1-5",
    DOT_PARTS,
    (ps) => " " + EYJ + ps.join("."),
    (ps) => !refJwt(EYJ + ps.join(".")),
  ],
  [
    "XJ9",
    "F7: dots at the end of the token are punctuation (none, one, two, three) and do not count",
    ["", ".", "..", "..."].flatMap((tail) => [
      EYJ + "a.b.c" + tail,
      EYJ + "a.b" + tail,
      EYJ + "a.b.." + tail + "c",
    ]),
    (t) => t,
    (t) => !refJwt(t),
  ],
];

// ---- F8: the word Bearer ----
const X_F8_SWEEPS = [
  [
    "XE1",
    "F8: the character behind Bearer is a space or a tab; none or another character is no Bearer value",
    ["", ...CHARS_X],
    (x) => "Bearer" + x + "abc1234",
    (x) => x !== " " && x !== "\t",
  ],
  [
    "XE2",
    "F8: a letter, a digit or _ to the left of Bearer is no boundary (any other character, also a letter outside ASCII, is)",
    ["", ...CHARS_X],
    (x) => x + "Bearer abc1234",
    isWord,
  ],
  ...Array.from({ length: 6 }, (_, k) => [
    `XE3${k}`,
    `F8: the letter ${k} of the word Bearer is that letter in any case (another character is no Bearer)`,
    CHARS_X,
    (x) => replaceAt("Bearer", k, x) + " abc1234",
    (x) => lowA(x) !== "bearer"[k],
  ]),
  [
    "XE4",
    "F8: Bearer one letter off - a letter dropped, put in or replaced, every letter in the other case (the case is not the word)",
    neighbours("Bearer"),
    (w) => w + " abc1234",
    (w) => lowA(w) !== "bearer",
  ],
  [
    "XE5",
    "F8: a run of spaces and tabs of any length after Bearer, then a literal (0, 1, 2, ... 9; tabs; mixed)",
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => [
      " ".repeat(n),
      "\t".repeat(n),
      " \t".repeat(n),
    ]),
    (r) => "Bearer" + r + "abc1234",
    (r) => r === "",
  ],
];

// ---- F9 and F2: the names, the quote, the sign ----
const X_NAME_PW = "=" + PW;
// the text of a pair: the value is the literal PW, so a recognised name is a refusal
const NAME_SLOT_NAMES = NAMES7;
const X_NAME_SWEEPS = NAME_SLOT_NAMES.flatMap((n) => [
  [
    `XN1${n}`,
    `F9: the character to the left of the name ${n} - a letter or a digit glues it into a longer segment (no name); _ and - leave a name; any other character starts the segment`,
    ["", ...CHARS_X],
    (x) => x + n + X_NAME_PW,
    isAlnum,
  ],
  [
    `XN2${n}`,
    `F9: the character behind the name ${n} - one quote, a colon or an equals sign is a pair; any other character, also a segment character, is not`,
    CHARS_X,
    (x) => n + x + X_NAME_PW,
    (x) => !(QUOTE_CHARS.includes(x) || x === ":" || x === "="),
  ],
  [
    `XN3${n}`,
    `F9: the character behind one quote after the name ${n} - a colon or an equals sign is the sign, anything else (also a second quote) is no pair`,
    CHARS_X,
    (x) => n + "'" + x + X_NAME_PW,
    (x) => !(x === ":" || x === "="),
  ],
  ...[...n].map((_, k) => [
    `XN4${n}${k}`,
    `F9: the letter ${k} of the name ${n} is that letter in any case; another character is another word`,
    CHARS_X,
    (x) => replaceAt(n, k, x) + X_NAME_PW,
    (x) => !NAMES7.includes(lowA(replaceAt(n, k, x))),
  ]),
  [
    `XN5${n}`,
    `F9: the name ${n} one letter off - a letter dropped, put in, replaced, every letter in the other case (the case keeps the name)`,
    neighbours(n),
    (w) => w + X_NAME_PW,
    (w) => !NAMES7.includes(lowA(w)),
  ],
  [
    `XN6${n}`,
    `F9: a long segment that ends with _ or - and the name ${n} is a name whatever its length (0 to 30 characters in front); glued without a separator it is not`,
    Array.from({ length: 31 }, (_, k) => "a".repeat(k)).flatMap((head) => [
      head + "_",
      head + "-",
      head,
    ]),
    (head) => head + n + X_NAME_PW,
    (head) => head !== "" && !/[_-]$/u.test(head),
  ],
]);
const X_NAME_OUTSIDE = [
  "pw",
  "pwd",
  "pass",
  "passw",
  "api-key",
  "apikeys",
  "tokens",
  "secrets",
  "authorisation",
  "auth",
  "key",
  "keys",
  "apikey2",
  "passwords",
  "Passwd2",
  "tok",
  "pswd",
  "secure",
  "api_keys",
  "x-api-key",
  "myToken",
  "tokenize",
  "credential",
  "credentials",
  "private_key",
  "access_key",
  "secret_key",
  "client_secret",
  "bearer",
  "private-key",
  "user_password",
  "db-token",
  "xtoken",
  "token_",
  "_token",
  "token-",
];
X_NAME_SWEEPS.push([
  "XN7",
  "F9: words outside the closed list of names are no name (pw, pwd, api-key, a plural, a letter more)",
  [...X_NAME_OUTSIDE, ...NAMES7],
  (w) => w + X_NAME_PW,
  (w) =>
    !NAMES7.includes(lowA(w)) &&
    !NAMES7.some((n) => lowA(w).endsWith("_" + n) || lowA(w).endsWith("-" + n)),
]);

// ---- F2: the scheme words and the optional quote around the scheme ----
const AUTH_CRED = " ${cred}";
const X_F2_SWEEPS = [
  valueSweep(
    "XA1",
    "F2: the slot between the white space and the word Basic - white space is skipped, one quote is the optional opening quote, any other character glues to the word",
    "au",
    [
      ...around("", "Basic" + AUTH_CRED),
      ...around("''", "Basic" + AUTH_CRED),
      ...CTRL,
    ],
  ),
  valueSweep(
    "XA2",
    "F2: the character behind the scheme word - white space or a quote ends it, any other character makes it another word",
    "au",
    [
      ...SCHEMES.flatMap((w) => around(w, AUTH_CRED)),
      ...SCHEMES.flatMap((w) => around(w, "")),
      ...SCHEMES.flatMap((w) => around(w, "a")),
      ...SCHEMES.flatMap((w) => around(w, "Ab")),
      ...SCHEMES.flatMap((w) => around(w, "(a)")),
      ...SCHEMES.flatMap((w) => around(w, "a>")),
      ...SCHEMES.flatMap((w) => around(w, "{a}")),
      ...SCHEMES.flatMap((w) => around(w, "{a}}")),
      ...CTRL,
    ],
  ),
  valueSweep(
    "XA3",
    "F2: the character before each of the nine scheme words (a quote may open a string in front of it)",
    "au",
    [...SCHEMES.flatMap((w) => around("", w + AUTH_CRED)), ...CTRL],
  ),
  valueSweep(
    "XA4",
    "F2: each scheme word with every letter in the other case, and every word a letter off (dropped, put in, replaced)",
    "au",
    [
      ...SCHEMES.flatMap((w) => [w, ...neighbours(w)]).map(
        (w) => w + AUTH_CRED,
      ),
      "Hmac" + AUTH_CRED,
      "Bearers" + AUTH_CRED,
      "Basics" + AUTH_CRED,
      "Negotiates" + AUTH_CRED,
      "Digestive" + AUTH_CRED,
      "Aws4" + AUTH_CRED,
      "Aws" + AUTH_CRED,
      "Jwt" + AUTH_CRED,
      "Mac" + AUTH_CRED,
      "Hawk" + AUTH_CRED,
      "Sso" + AUTH_CRED,
      "Basi" + AUTH_CRED,
      "Apikeys" + AUTH_CRED,
      "Key" + AUTH_CRED,
      "Api" + AUTH_CRED,
      "Oauth2" + AUTH_CRED,
      "Negotiat" + AUTH_CRED,
      ...CTRL,
    ],
  ),
  valueSweep(
    "XA5",
    "F2: a slot inside each scheme word - the word is then another word",
    "au",
    [...SCHEMES.flatMap((w) => inside(w).map((v) => v + AUTH_CRED)), ...CTRL],
  ),
  valueSweep(
    "XA6",
    "F2: the character between the sign and the value, in the several places - one quote before the scheme, a second quote, white space around the scheme",
    "au",
    [
      ...around("", AUTH_CRED.slice(1)),
      ...around("Basic", " " + PW),
      ...around("Basic ", PW),
      ...around('"', "Basic " + PW),
      ...around('"Basic', " " + PW),
      ...CTRL,
    ],
  ),
];

// ---- the structure characters of the value classes (rework 08m): every character of a
// template, a path, a call and a bare name is replaced by every character in turn ----
const X_TEMPLATES = [
  "${A}",
  "${{A}}",
  "{{A}}",
  "$(A)",
  "<A>",
  "$TOKEN",
  "%TOKEN%",
];
const X_TEMPLATE_ITEMS = [
  ...X_TEMPLATES.flatMap((t) =>
    [...t].flatMap((_, k) => CHARS_X.map((x) => replaceAt(t, k, x))),
  ),
  ...CTRL,
];
// the separator of a path, the bracket of a call, the underscore of a bare name: replaced
const X_STRUCT_ITEMS = [
  ...around("a", "b"),
  ...around("a?", "b"),
  ...around("a.b", "c"),
  ...around("a", "?.b"),
  ...around("f", "x"),
  ...around("f", "x)"),
  ...around("a.b", "x"),
  ...around("a.b", "x)"),
  ...around("ab", "Cd"),
  ...around("a", "Bc"),
  ...around("ab", "C"),
  ...around("aZ", "B"),
  ...around("aZ", "z"),
  ...around("a", "Z"),
  ...around("z", "A"),
  ...around("@", "a"),
  ...around("{", "a"),
  ...around("[", "a"),
  ...around("`", "a"),
  ...CTRL,
];
// a group with an arbitrary character inside it and closers behind it: the closers are
// dropped by count; the group is then the whole value
const X_GROUP_CLOSERS = [
  ...[")", "]", "}", ")]", "]}", "})", ")))", "]]]"].flatMap((tail) =>
    ["${", "<", "$(", "{{", "${{"].flatMap((open) =>
      around(
        open,
        { "${": "}", "<": ">", "$(": ")", "{{": "}}", "${{": "}}" }[open] +
          tail,
      ),
    ),
  ),
  ...CTRL,
];
// the words with a punctuation mark inside: every character in the place of the mark
// (a case map that moves a character onto - or _ would make "change?me" a placeholder)
const X_PUNCT_WORDS = ["change-me", "change_me"].flatMap((w) =>
  [...w].flatMap((c, k) =>
    /[A-Za-z]/u.test(c) ? [] : CHARS_X.map((x) => replaceAt(w, k, x)),
  ),
);
// the 26 words with every letter replaced by every character (the one place where a case
// map or a prefix test could be wrong), in the quotation
const X_REPLACED_PH = PH26.flatMap((w) =>
  [...w].flatMap((_, k) => CHARS_X.map((x) => replaceAt(w, k, x))),
);

const X_STRUCT_SWEEPS = [
  ...["u", "q34", "a"].map((place) =>
    valueSweep(
      `XT${place}`,
      `Sh: every character of a template (${X_TEMPLATES.join(" ")}) replaced by every character - the opener, the closer, the name (${place})`,
      place,
      X_TEMPLATE_ITEMS,
    ),
  ),
  ...["u", "s", "b", "q34", "a"].map((place) =>
    valueSweep(
      `XS${place}`,
      `B1-B3: the dot, the question mark, the bracket of a call, the underscore and the letters of a bare name replaced by every character (${place})`,
      place,
      X_STRUCT_ITEMS,
    ),
  ),
  ...["u", "s", "b", "q34", "a"].map((place) =>
    valueSweep(
      `XG${place}`,
      `Sh and the closers: a group with an arbitrary character inside it and up to three closers behind it (${place})`,
      place,
      X_GROUP_CLOSERS,
    ),
  ),
  ...["u", "q34", "a", "s", "b"].map((place) =>
    valueSweep(
      `XI${place}`,
      `Z: change-me and change_me with every character in the place of the mark (${place})`,
      place,
      [...X_PUNCT_WORDS, ...CTRL],
    ),
  ),
  valueSweep(
    "XRq34",
    "Z: each of the 26 words with each of its letters replaced by every character - only the word itself is a placeholder (quotation)",
    "q34",
    [...X_REPLACED_PH, ...CTRL],
  ),
];

// ---- the bracket soup (rework 08m): every string of up to four characters over the
// characters that decide the value classes (the three brackets and their closers, the
// block characters, the openers of a template, a letter, a capital, the dot) is a value;
// the reference says which of them is a placeholder, an expression or a literal, so each
// opener, closer, counter and walk-back of the closers is tried against every other ----
const SOUP = ["(", ")", "[", "]", "{", "}", "|", ">", "<", "$", "a", "B", "."];
const soupTo = (n) =>
  n === 0 ? [""] : soupTo(n - 1).flatMap((head) => SOUP.map((c) => head + c));
const X_SOUP4 = [1, 2, 3, 4].flatMap(soupTo);
const X_SOUP3 = [1, 2, 3].flatMap(soupTo);
// an opener whose second (or third) character is replaced by every character, with a
// balanced content and the closers behind it: the opener is the whole group or not
const X_OPENER_ITEMS = [
  ...around("$", "a{b}"),
  ...around("${", "a{}}"),
  ...around("$", "a(b)"),
  ...around("{", "a{b}}"),
  ...around("{{", "a{b}}"),
  ...around("<", "a{b}>"),
  ...around("$", "a{b}}"),
  // an unbalanced pair inside a group, with a matching closer behind it: a character in the
  // group is counted as an opener or closer only if it is one
  ...[
    ["<", ">"],
    ["${", "}"],
    ["{{", "}}"],
  ].flatMap(([open, close]) =>
    [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ].flatMap(([inner, innerClose]) => [
      ...around(open + "a", inner + "b" + close + innerClose),
      ...around(open + "a", innerClose + "b" + close),
      ...around(open + "a", close + innerClose),
    ]),
  ),
  ...CTRL,
];
const X_SOUP_SWEEPS = [
  ...["u", "s"].map((place) =>
    valueSweep(
      `XB${place}`,
      `B1-B4, Sh and the closers: every string of up to four characters over ( ) [ ] { } | > < $ a B . as a value (${place})`,
      place,
      [...X_SOUP4, ...CTRL],
    ),
  ),
  valueSweep(
    "XBq34",
    "Z and Sh: every string of up to three characters over ( ) [ ] { } | > < $ a B . inside a quotation (B1-B4 do not apply there)",
    "q34",
    [...X_SOUP3, ...CTRL],
  ),
  ...["u", "s", "b"].map((place) =>
    valueSweep(
      `XO${place}x`,
      `Sh: the second or third character of an opener replaced by every character, with a balanced content behind it (${place})`,
      place,
      X_OPENER_ITEMS,
    ),
  ),
];

// ---- the words just outside the closed lists (rework 08m): the list of placeholders
// stays closed (decisions/0102 items 22 and 30: test words such as tok and pw are
// refused), so are the lists of types, names, schemes and key prefixes. Words of other
// lists and words that a test fixture likes to use stand in the value places; the
// reference says what each one is in each place. ----
const X_OUTSIDE_WORDS = uniqList(
  [
    // test words and words next to the list of placeholders
    "pw",
    "tok",
    "keys",
    "pwds",
    "passwords",
    "abc",
    "foo",
    "bar",
    "baz",
    "qux",
    "fake",
    "todo",
    "tbd",
    "temp",
    "tmp",
    "secrets",
    "tokens",
    "changeme2",
    "demo2",
    "uname",
    "login",
    "pass1",
    "mykey",
    "xyz",
    "hunter",
    "secure",
    "default",
    "dev",
    "local",
    "localhost",
    "redacted",
    "hidden",
    "masked",
    "value",
    "val",
    "data",
    "text",
    "name",
    "email",
    "unset",
    "empty",
    "blank",
    "foobar",
    "hunter2",
    "letmein",
    "qwerty",
    "welcome",
    "secret1",
    "Passw0rd",
    // types and keywords next to the list
    "char",
    "double",
    "long",
    "short",
    "byte",
    "uint",
    "nan",
    "int32",
    "int64",
    "tuple",
    "set",
    "map",
    "array",
    "var",
    "let",
    "const",
    "def",
    "class",
    "func",
    "fn",
    "yield",
    "obj",
    "arr",
    "vec",
    "u8",
    "i32",
    "usize",
    "real",
    "complex",
    "decimal",
    "binary",
    "integer",
    "varchar",
    "datetime",
    "date",
    "uuid",
    "json",
    "String",
    "Number",
    "Boolean",
    "Object",
    "Function",
    "TRUE",
    "FALSE",
    "None",
    // names and schemes as plain values
    "pwd",
    "auth",
    "api-key",
    "apikeys",
    "private",
    "public",
    "credential",
    "credentials",
    "passw",
    "pswd",
    "Hmac",
    "Aws4",
    "Aws",
    "Jwt",
    "Mac",
    "Hawk",
    "Sso",
    "Negotiates",
    "Bearers",
    "Basics",
    "Digests",
    "ApiKeys",
    "Bots",
    "OAuth2",
    "Api",
    "Key",
    ...PH26,
    ...V3_WORDS,
    ...SCHEMES,
    ...NAMES7,
  ].flatMap((w) => [w, w[0].toUpperCase() + w.slice(1)]),
);
const AK_OUTSIDE = [
  "AGPA",
  "AIDA",
  "ANPA",
  "ANVA",
  "AROA",
  "AIPA",
  "ACCA",
  "ABIA",
  "BKIA",
  "AKIB",
  "AKI",
  "AXIA",
  "ASIB",
  "ASI",
  "ACIA",
];
const X_WORD_SWEEPS = [
  ...["u", "q34", "a", "s", "b"].map((place) =>
    valueSweep(
      `XZ${place}`,
      `the lists are closed: a word of another list, a test word, a word next to a list is judged by the classes of the value (${place})`,
      place,
      [...X_OUTSIDE_WORDS, ...CTRL],
    ),
  ),
  [
    "XKak",
    "F6: the prefixes AKIA and ASIA are the only ones; the other prefixes of this family of keys (AGPA, AIDA, ANPA ...) are stored",
    [...AK_OUTSIDE, "AKIA", "ASIA"],
    (p) => p + U(16),
    (p) => p !== "AKIA" && p !== "ASIA",
  ],
];

const EXHAUSTIVE_SWEEPS = [
  ...X_VALUE_SWEEPS,
  ...X_STRUCT_SWEEPS,
  ...X_SOUP_SWEEPS,
  ...X_WORD_SWEEPS,
  ...X_F1_SWEEPS,
  ...X_F3_SWEEPS,
  ...X_KEY_SWEEPS,
  ...X_F7_SWEEPS,
  ...X_F8_SWEEPS,
  ...X_NAME_SWEEPS,
  ...X_F2_SWEEPS,
];
// X-END

// [id, the rule in words, the characters, the text for a character, stored for a character]
const SWEEPS = [
  [
    "T1",
    "an unquoted value ends at white space, a quote, a comma or a semicolon, and only there",
    CHARS_ALL,
    (x) => "token=${A}" + x + "y",
    endsValue,
  ],
  [
    "T2",
    "after the colon of Authorization only the listed white space is skipped; a quote opens a string, a comma ends an empty value",
    CHARS_ALL,
    (x) => "Authorization:" + x + "${A}",
    endsValue,
  ],
  [
    "I1",
    "class V1: the first identifier of a path is made of letters, _ and $",
    CHARS_ALL.filter((x) => !endsValue(x)),
    (x) => "token=" + x + ".b",
    isIdent,
  ],
  [
    "I2",
    "class V1/V2: a character in the middle of the first identifier (a call if it is an opening bracket, a path with ?.)",
    CHARS_ALL.filter((x) => !endsValue(x)),
    (x) => "token=a" + x + ".b",
    (x) => isIdent(x) || x === "(" || x === "?",
  ],
  [
    "I3",
    "class V1/V2: the last character of a path; trailing closers are dropped; a bracket makes a call",
    CHARS_ALL,
    (x) => "token=a.b" + x,
    (x) => isIdent(x) || endsValue(x) || x === "(" || ")]}".includes(x),
  ],
  [
    "B1",
    "class V3: a bare name is letters and _ with a lower-case letter before an upper-case one, or with _ and a letter",
    CHARS_ALL,
    (x) => "token: a" + x + "B",
    (x) => /^[A-Za-z_]$/u.test(x) || x === "(" || x === ".",
  ],
  [
    "N1",
    "the name of a pair is a whole segment of [A-Za-z0-9_-]: a letter or a digit glued to the left is no name, _ or - is",
    CHARS_ALL,
    (x) => x + "token=hunter2fake",
    isAlnum,
  ],
  [
    "N2",
    "after the name: one quote, then : or =; any other character, or a longer segment, is no pair",
    CHARS_ALL,
    (x) => "token" + x + "=hunter2fake",
    (x) => !(QUOTE_CHARS.includes(x) || x === ":" || x === "="),
  ],
  [
    "U1",
    "F3: the character to the left of :// is one of [A-Za-z0-9+.-]",
    CHARS_PRINT,
    (x) => x + "://deploy:" + PW + "@host/x",
    (x) => !isScheme(x),
  ],
  [
    "U2",
    "F3: the user has no /, @, : or white space",
    CHARS_ALL,
    (x) => "https://u" + x + "ser:" + PW + "@host",
    (x) => WS.includes(x) || x === "/" || x === "@",
  ],
  [
    "U3",
    "F3: the password has no / or white space and ends at @",
    CHARS_ALL,
    (x) => "https://deploy:" + PW + x + "y@host",
    (x) => WS.includes(x) || x === "/",
  ],
  [
    "E1",
    "F8: only spaces and tabs follow the word Bearer",
    CHARS_ALL,
    (x) => "Bearer" + x + "abc1234",
    (x) => x !== " " && x !== "\t",
  ],
  [
    "E2",
    "F8: a letter, a digit or _ to the left of the word Bearer is no boundary",
    CHARS_ALL,
    (x) => x + "Bearer abc1234",
    isWord,
  ],
  [
    "J1",
    "F7: a character of the run [A-Za-z0-9_.-] to the left of eyJ - the dot too - means it does not start a run",
    CHARS_ALL,
    (x) => x + JWT3,
    isRun,
  ],
  [
    "J2",
    "F7: a dot after the third part makes four parts; any other character leaves three",
    CHARS_ALL,
    (x) => JWT3 + x + "y",
    (x) => x === ".",
  ],
  ...KEYS.map((key, i) => [
    `L${i}`,
    "F4-F6: a letter or a digit to the left of the prefix is no boundary",
    CHARS_PRINT,
    (x) => x + key,
    isAlnum,
  ]),
  ...[AKIA, ASIA].map((prefix, i) => [
    `R${i}`,
    "F6: a character of [A-Za-z0-9_+=-] to the right of the body means it is not a key",
    CHARS_PRINT,
    (x) => prefix + U(16) + x,
    isTokenEnd,
  ]),
  [
    "K0",
    "F4: the body of sk- is [A-Za-z0-9_-]",
    CHARS_PRINT,
    (x) => "sk-" + N(8) + x + N(8),
    (x) => !isSegment(x),
  ],
  [
    "K1",
    "F6: the 16 characters of the body are [A-Z0-9]",
    CHARS_PRINT,
    (x) => AKIA + U(8) + x + U(7),
    (x) => !/^[A-Z0-9]$/u.test(x),
  ],
  // Sh: the characters of a name of %NAME% and $NAME% (first, second, middle and last).
  [
    "M0",
    "Sh: the first character of the name of %NAME% is a letter or _",
    CHARS_ALL,
    (x) => "token=%" + x + "OKEN%",
    (x) => /^[A-Za-z_]$/u.test(x),
  ],
  [
    "M1",
    "Sh: the second character of the name of %NAME% is a letter, a digit or _",
    CHARS_ALL,
    (x) => "token=%T" + x + "OKEN%",
    isWord,
  ],
  [
    "M2",
    "Sh: a character in the middle of the name of %NAME%",
    CHARS_ALL,
    (x) => "token=%TOK" + x + "N%",
    isWord,
  ],
  [
    "M3",
    "Sh: the last character of the name of %NAME%",
    CHARS_ALL,
    (x) => "token=%TOKE" + x + "%",
    isWord,
  ],
  [
    "D0",
    "Sh: the first character of the name of $NAME is a letter or _ (a path or a call also keeps)",
    CHARS_ALL,
    (x) => "token=$" + x + "OKEN",
    (x) => /^[A-Za-z_]$/u.test(x) || x === "(" || x === ".",
  ],
  [
    "D1",
    "Sh: the second character of the name of $NAME (a path, a call, or the end of the value)",
    CHARS_ALL,
    (x) => "token=$T" + x + "OKEN",
    (x) => isWord(x) || endsValue(x) || x === "(" || x === ".",
  ],
  [
    "D2",
    "Sh: a character in the middle of the name of $NAME",
    CHARS_ALL,
    (x) => "token=$TOK" + x + "N",
    (x) => isWord(x) || endsValue(x) || x === "(" || x === ".",
  ],
  [
    "D3",
    "Sh: the last character of the name of $NAME (trailing closers are dropped)",
    CHARS_ALL,
    (x) => "token=$TOKE" + x,
    (x) => isWord(x) || endsValue(x) || x === "(" || ")]}".includes(x),
  ],
  // Z: "your" at the start and "example" anywhere, only in a value of [A-Za-z0-9_.-].
  [
    "Y0",
    "Z: a value that starts with your is a placeholder if it is made of [A-Za-z0-9_.-]",
    CHARS_ALL,
    (x) => "token=your" + x,
    (x) => isRun(x) || endsValue(x) || x === "(" || ")]}".includes(x),
  ],
  [
    "Y1",
    "Z: a value with example inside is a placeholder if it is made of [A-Za-z0-9_.-]",
    CHARS_ALL,
    (x) => "token=example" + x,
    (x) => isRun(x) || endsValue(x) || x === "(" || ")]}".includes(x),
  ],
  [
    "Y2",
    "Z: a character before example (a name template $example also keeps)",
    CHARS_ALL,
    (x) => "token=" + x + "example",
    (x) => isRun(x) || endsValue(x) || x === "$",
  ],
  [
    "U4",
    "F3: a separator right after the colon makes the password empty ($NAME is a template)",
    CHARS_ALL,
    (x) => "https://deploy:" + x + PW + "@host",
    (x) => WS.includes(x) || x === "/" || x === "@" || x === "$",
  ],
  ...QUOTE_CHARS.flatMap((q) => [
    [
      `Q${q.charCodeAt(0)}`,
      "F8: a quote after Bearer is a closing quote only when white space follows; the same quote twice is an empty string; $NAME in quotes is a template",
      CHARS_ALL,
      (x) => "Bearer " + q + x + "abc1234",
      (x) => WS.includes(x) || x === q || x === "$",
    ],
    [
      `S${q.charCodeAt(0)}`,
      "F2: the same after a scheme",
      CHARS_ALL,
      (x) => "Authorization: " + BASIC + " " + q + x + "abc1234",
      (x) => WS.includes(x) || x === q || x === "$",
    ],
  ]),
  ...[GHP, GHO, GHS, GHPAT].map((prefix, i) => [
    `K${2 + i}`,
    "F5: a letter or a digit counts in the 20 characters after the prefix",
    ALNUM_CHARS,
    (x) => prefix + N(10) + x + N(9),
    () => false,
  ]),
  ...TEMPLATE_SWEEPS,
  ...TEMPLATE_LONG_SWEEPS,
  ...YOUR_BEFORE_SWEEPS,
  ...CHAIN_AFTER_SWEEPS,
  ...WS_RUN_SWEEPS,
  ...BLOCK_SWEEPS,
  ...CASE_SWEEPS,
  ...EXHAUSTIVE_SWEEPS,
];
// every row: { id, text, stored }; a slot of one character is named by its code, a slot of
// several characters (a run, a word) by its place in the list
const SWEEP_ROWS = SWEEPS.flatMap(([id, , chars, text, stored]) =>
  chars.map((x, index) => ({
    id: `${id}#${typeof x === "string" && x.length === 1 ? x.charCodeAt(0).toString(16).padStart(4, "0") : `i${String(index).padStart(4, "0")}`}`,
    text: text(x),
    stored: stored(x),
  })),
);
// the rows of the sweeps of the reworks before 08m come first, the sweeps of 08m after them
const OLD_SWEEP_ROWS = 24160;
// SWEEP-END

test("RB-08 criterion 3: both cases of every pair of the boundary, by findSecrets and through the store (a stored sample is accepted, its pair is refused)", (t) => {
  assert.ok(PAIRS.length >= 60);
  const p = freshProject(t);
  PAIRS.forEach(([keptId, refusedId, why], i) => {
    const kept = keepText(keptId);
    const refused = refuseText(refusedId);
    assert.equal(findSecrets(kept), null, `${why}: ${keptId}`);
    assert.notEqual(findSecrets(refused), null, `${why}: ${refusedId}`);
    p.writer.importResultBytes({
      name: `kept-${i}.md`,
      bytes: Buffer.from(kept),
    });
    const err = caught(() =>
      p.writer.importResultBytes({
        name: `refused-${i}.md`,
        bytes: Buffer.from(refused),
      }),
    );
    assert.equal(err.details?.reason, "secret", `${why}: ${refusedId}`);
  });
  assert.equal(fs.readdirSync(path.join(p.dir, "files")).length, PAIRS.length);
});

// ---- RB-09: the closed list of placeholders ---------------------------------------------------

const WORDS = [
  "password",
  "passwd",
  "pass",
  "pwd",
  "secret",
  "token",
  "key",
  "changeme",
  "change-me",
  "change_me",
  "changeit",
  "example",
  "sample",
  "placeholder",
  "dummy",
  "demo",
  "test",
  "admin",
  "root",
  "user",
  "guest",
  "postgres",
  "mysql",
  "none",
  "null",
  "undefined",
];
const PLACES = [
  (v) => `password: '${v}'`,
  (v) => `password=${v}`,
  (v) => `https://u:${v}@h`,
];
const CASINGS = [
  (w) => w,
  (w) => w.toUpperCase(),
  (w) => w[0].toUpperCase() + w.slice(1),
];

test("RB-09 criterion 3: the list of 26 words - a word is stored in the three places in three casings, a word with a digit is refused, example9 is stored; the extra placeholders; a user name as the password", () => {
  assert.equal(WORDS.length, 26);
  assert.equal(new Set(WORDS).size, 26);
  let checks = 0;
  for (const word of WORDS) {
    for (const casing of CASINGS) {
      for (const place of PLACES) {
        const plain = place(casing(word));
        assert.equal(findSecrets(plain), null, plain);
        const added = place(casing(`${word}9`));
        if (word === "example") {
          assert.equal(findSecrets(added), null, added);
        } else {
          assert.notEqual(findSecrets(added), null, added);
        }
        checks += 2;
      }
    }
  }
  assert.equal(checks, 26 * 3 * 3 * 2);
  for (const value of [
    "your-key",
    "xxxx",
    "***",
    "pw-example",
    "YOUR_API_KEY",
  ]) {
    for (const place of PLACES) {
      assert.equal(findSecrets(place(value)), null, place(value));
    }
  }
  assert.notEqual(findSecrets("https://u:u@h"), null);
  assert.notEqual(findSecrets("https://имя:имя@h"), null);
});

// ---- RB-10: the rules live only in mask.js --------------------------------------------------------

const BAIT_SHAPES = new RegExp(
  [
    "ghp_[A-Za-z0-9]{36}",
    "AKIA[A-Z0-9]{16}",
    `${"-----"}BEGIN [A-Z ]*PRIVATE KEY-----`,
    "sk_live_[A-Za-z0-9]{10,}",
    "Basic [A-Za-z0-9+/]{12,}",
  ].join("|"),
  "u",
);

function walkFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walkFiles(abs, out);
    else out.push(abs);
  }
  return out;
}

test("RB-10 criterion 3 (Q7): no key-shaped text stands in the new test files; the rules of secrets are only in mask.js, the core of the team holds none of their words, one import line", () => {
  const testsDir = path.dirname(THIS_FILE);
  for (const name of fs
    .readdirSync(testsDir)
    .filter((n) => /^team-result-.*[.]test[.]js$/u.test(n))) {
    const text = fs.readFileSync(path.join(testsDir, name), "utf8");
    assert.equal(
      BAIT_SHAPES.test(text),
      false,
      `${name} holds a key-shaped text`,
    );
  }
  const words = new RegExp(
    [
      "AKIA",
      "ASIA",
      "github_pat",
      `${"-----"}BEGIN`,
      "MASK_LABEL",
      "скрыто",
    ].join("|"),
    "u",
  );
  for (const file of walkFiles(TEAM_SRC)) {
    assert.equal(
      words.test(fs.readFileSync(file, "utf8")),
      false,
      path.relative(TOOLS_DIR, file),
    );
  }
  const importers = walkFiles(TEAM_SRC).filter((f) =>
    /^import .*pixel-office\/mask\.js";$/mu.test(fs.readFileSync(f, "utf8")),
  );
  assert.ok(
    importers.length >= 3,
    "store.js, runner.js and language.js import from mask.js",
  );
  for (const file of importers) {
    const lines = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.includes("pixel-office/mask.js"));
    assert.equal(
      lines.length,
      1,
      `${path.basename(file)}: the import of mask.js is one line`,
    );
  }
});

// ---- RB-11: criterion 4, the state after a refusal ----------------------------------------------------

function worldOf(p) {
  const bytes = fs.readFileSync(p.events);
  return {
    tree: snapshot(p.home),
    state: structuredClone(p.writer.state),
    lines: bytes.toString("utf8").split("\n").length - 1,
    journal: sha256(bytes),
  };
}

for (const [kind, put] of INPUTS) {
  test(`RB-11 criterion 4 (${kind}): after every refusal of the groups C (alone, and after the whole assembly O10) the files, the writer state and the journal are exactly as before, no partial file; the writer works on: O1 is accepted and the journal grows by one RESULT_FILE`, (t) => {
    const groups = Object.keys(REFUSE);
    // Rework 08g (remark F1): the same refusal when a kept sample of every form stands
    // in front of the secret (the scan that goes on after kept items must not leave a
    // trace of its work either).
    const places = [
      ["alone", (text) => text],
      [POSITIONS[3][0], POSITIONS[3][1]],
    ];
    let counter = 0;
    for (const group of groups) {
      const p = freshProject(t);
      const dir = path.join(p.dir, "files");
      for (const sample of REFUSE_ALL.filter((s) => s.group === group)) {
        for (const [where, place] of places) {
          counter += 1;
          const name = `r-${counter}.md`;
          const text = place(sample.text);
          if (kind === "importWorkFile") {
            fs.writeFileSync(path.join(p.writer.workDir, name), text);
          }
          const before = worldOf(p);
          const err = caught(() => put(p, name, text));
          assert.equal(err.details?.reason, "secret", `${sample.id} ${where}`);
          const after = worldOf(p);
          assert.deepStrictEqual(
            after,
            before,
            `${kind} ${sample.id} ${where}: the state changed`,
          );
          assert.equal(fs.existsSync(path.join(dir, name)), false);
          assert.deepEqual(
            fs.readdirSync(dir).filter((n) => n.startsWith(".")),
            [],
            "no partial file",
          );
          // the writer is whole: the next call is accepted, one line is added
          const next = `ok-${counter}.md`;
          const event = put(p, next, keepText("O1#0"));
          assert.equal(event.type, "RESULT_FILE");
          const now = worldOf(p);
          assert.equal(now.lines, before.lines + 1, sample.id);
          assert.equal(journalOf(p.events).at(-1).data.name, next);
        }
      }
    }
  });
}

// ---- RB-16: criterion 8 (b), the journal text is masked as before ----------------------------------------

test("RB-16 criterion 8 (b): the text const v = a.b.c; password=hunter2fake, said by the user, stored as memory and given as the goal, is masked as before in the journal; a file with const v = a.b.c; in the same project is stored unchanged", (t) => {
  const home = makeHome(t);
  const text = "const v = a.b.c; password=hunter2fake";
  const expected = `const v = ${LABEL}; password=${LABEL}`;
  const { id } = createProject(
    { goal: text, budget_usd: 1, executor: "claude-cli" },
    { home },
  );
  const w = openWriter(id, { home });
  t.after(() => w.close());
  w.say(text);
  w.addMemory({ kind: "fact", text }, "USER");
  w.writeResultFile({ name: "code.md", content: "const v = a.b.c;" });
  const events = journalOf(path.join(home, id, "events.jsonl"));
  assert.equal(events[0].data.goal, expected);
  const said = events.find((e) => e.type === "CHAT" && e.source === "USER");
  assert.equal(said.data.text, expected);
  const memory = events.find((e) => e.type === "MEMORY_ADDED");
  assert.equal(memory.data.text, expected);
  assert.equal(maskSecrets(text), expected);
  assert.equal(
    fs.readFileSync(path.join(home, id, "files", "code.md"), "utf8"),
    "const v = a.b.c;",
  );
});

// ---- the engine on the fake executable: helpers ---------------------------------------------

const TASK_TEXT = "Вымышленная задача memo";
const BAIT_A = `${GHP}${N(36)}`;
const BAIT_B = `${GHP}${U(36)}`;
const bait = (key, extra = "") =>
  `Пример ключа в документации: ${key}${extra} и обычный a.b.c\n`;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.lstatSync(full);
    out.push({ full, st });
    if (st.isDirectory()) walk(full, out);
  }
  return out;
}

// The names of the files under root that hold the needle (a file named `except` is left out).
const FOUND = (root, needle, except = null) =>
  walk(root)
    .filter(({ full, st }) => st.isFile() && path.basename(full) !== except)
    .filter(({ full }) => fs.readFileSync(full).includes(needle))
    .map(({ full }) => path.basename(full));

const workOf = (p) => fs.readdirSync(path.join(p.dir, "work")).sort();
const filesOf = (p) => fs.readdirSync(path.join(p.dir, "files")).sort();

// One task whose run writes `files` ([path, content]) into work/ and names `answer`
// (the paths, all of them by default).
function refusalProject(t, files, answer) {
  return readsProject(t, {
    goal: "Проект для проверки отказа по секрету",
    tasks: [item("memo", { done_when: "Есть итог" })],
    work: [
      {
        files: files.map(([file, content]) => ({ path: file, content })),
        ...(answer === undefined ? {} : { answer }),
      },
    ],
  });
}

async function runToEnd(t, p) {
  const e = startEngine(t, p);
  await until(p, isEnd, "a wait or an end");
  await pauseAndExit(e);
  return journal(p);
}

// The visible texts of one refusal on the engine path: the detail of the event, the
// question of the team and data.detail of the command `events <id>`.
function visibleTexts(p, events) {
  const failed = ofType(events, "TASK_FAILED");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].data.reason, "result_file");
  const question = ofType(events, "CHAT").find(
    (e) => e.data.kind === "question",
  );
  const view = runTeam(["events", p.id], p.env);
  assert.equal(view.status, 0, view.stderr);
  const shown = JSON.parse(view.stdout).events.find(
    (e) => e.type === "TASK_FAILED",
  );
  const project = runTeam(["project", p.id], p.env);
  assert.equal(project.status, 0, project.stderr);
  const chat = JSON.parse(project.stdout).project.chat;
  return {
    event: failed[0].data.detail,
    question: question.data.text,
    shown: shown.data.detail,
    phrase: shown.phrase,
    chat: chat.map((c) => c.text),
  };
}

const QUESTION = (detail) =>
  `Задача «${TASK_TEXT}» не получилась: ${detail}. Изменить её или отклонить?`;

// What every refusal by a secret leaves on the engine path (criterion 5).
function assertRefusedWhole(p, events, { baits, detail, work = [] }) {
  assert.equal(ofType(events, "RESULT_FILE").length, 0, "no RESULT_FILE");
  assert.deepEqual(filesOf(p), [], "files/ is empty");
  assert.deepEqual(workOf(p), work, "work/");
  const runs = ofType(events, "RUN_STARTED").filter((e) => e.task === "t-0001");
  assert.equal(runs.length, 1, "one run of the task, no retry");
  assert.equal(ofType(events, "TASK_FAILED").length, 1);
  assert.equal(ofType(events, "TASK_REVIEW").length, 0);
  const texts = visibleTexts(p, events);
  assert.equal(texts.event, detail);
  assert.equal(texts.shown, detail);
  assert.equal(texts.question, QUESTION(detail));
  assert.deepEqual(texts.chat, [QUESTION(detail)]);
  assert.equal(
    texts.phrase,
    "Исследователь: файл с результатом не принят — в нём найден секрет",
  );
  for (const text of [texts.event, texts.question, texts.shown]) {
    assert.equal(text.includes(LABEL), false, "no label in the texts");
    assert.equal(maskSecrets(text), text, "the text is its own masked form");
    for (const key of baits) assert.equal(text.includes(key), false);
  }
  for (const key of baits) {
    assert.deepEqual(
      FOUND(p.dir, key),
      [],
      "the bait is on disk in the project",
    );
    assert.deepEqual(
      FOUND(p.fakeDir, key, "plan.json"),
      [],
      "the bait is in the fake home",
    );
    for (const s of p.stdins()) {
      assert.equal(s.text.includes(key), false, `stdin-${s.n} holds the bait`);
    }
  }
  for (const { full, st } of walk(p.dir)) {
    const what = path.relative(p.sb.root, full);
    // a source left in work/ is the file of the executor, written with its own umask
    if (st.isFile() && full.startsWith(path.join(p.dir, "work", path.sep)))
      continue;
    assert.equal(st.mode & 0o077, 0, `${what} is open to others`);
    if (st.isFile()) assert.equal(st.mode & 0o111, 0, `${what} is executable`);
    assert.equal(st.isSymbolicLink(), false, what);
  }
}

// A second project of the same test holds nothing of the first (as SF-13).
async function assertSecondProjectEmpty(t, p, needles) {
  const q = readsProject(t, {
    goal: "ВТОРОЙ-ПРОЕКТ цель",
    tasks: [
      item("z", { text: "ВТОРОЙ-ПРОЕКТ-задача", done_when: "Есть итог" }),
    ],
    work: [
      { files: [{ path: "second.md", content: "ВТОРОЙ-ПРОЕКТ-СОДЕРЖИМОЕ\n" }] },
    ],
    goalScript: [{ passed: true, notes: "Хорошо" }],
    reviewTask: true,
  });
  assert.notEqual(q.id, p.id);
  await runToEnd(t, q);
  for (const needle of [...needles, p.id]) {
    assert.deepEqual(FOUND(q.dir, needle), [], needle);
    assert.deepEqual(FOUND(q.fakeDir, needle, "plan.json"), [], needle);
  }
}

// ---- RB-12: criterion 5, the whole attempt is refused ---------------------------------------------

const ACCEPTED = (name) => `t-0001-1-${name}`;
const WITH = (names) => {
  const list = names.map(ACCEPTED);
  return list.length === 1
    ? ` (файл: ${list[0]})`
    : ` (файлы: ${list.join(", ")})`;
};

test(
  "RB-12 criterion 5 (a): one named file with the bait C1 - the attempt is refused whole, nothing is written, the bait is nowhere on disk (also not in work/), not in any input, the text names the file",
  { timeout: 60_000 },
  async (t) => {
    const p = refusalProject(t, [["memo_research.md", bait(BAIT_A)]]);
    const events = await runToEnd(t, p);
    assertRefusedWhole(p, events, {
      baits: [BAIT_A],
      detail: `${SECRET_TEXT}${WITH(["memo_research.md"])}`,
    });
    await assertSecondProjectEmpty(t, p, [BAIT_A, "memo_research.md"]);
  },
);

test(
  "RB-12 criterion 5 (b): two named files O1 and a bait - neither is accepted (all files are checked before the first write), the source of O1 stays in work/, the source of the bait is gone, only the bait is named",
  { timeout: 60_000 },
  async (t) => {
    const p = refusalProject(t, [
      ["good.md", `${keepText("O1#0")}\n`],
      ["bad.md", bait(BAIT_A)],
    ]);
    const events = await runToEnd(t, p);
    assertRefusedWhole(p, events, {
      baits: [BAIT_A],
      detail: `${SECRET_TEXT}${WITH(["bad.md"])}`,
      work: ["good.md"],
    });
    assert.equal(
      fs.readFileSync(path.join(p.dir, "work", "good.md"), "utf8"),
      `${keepText("O1#0")}\n`,
      "the clean source is untouched",
    );
    await assertSecondProjectEmpty(t, p, [BAIT_A, "good.md", "bad.md"]);
  },
);

test(
  "RB-12 criterion 5 (b-bis): two files with a bait each - both are refused, work/ holds neither source, both names are listed",
  { timeout: 60_000 },
  async (t) => {
    const p = refusalProject(t, [
      ["first.md", bait(BAIT_A)],
      ["second.md", bait(BAIT_B)],
    ]);
    const events = await runToEnd(t, p);
    assertRefusedWhole(p, events, {
      baits: [BAIT_A, BAIT_B],
      detail: `${SECRET_TEXT}${WITH(["first.md", "second.md"])}`,
    });
    await assertSecondProjectEmpty(t, p, [BAIT_A, BAIT_B, "first.md"]);
  },
);

test(
  "RB-12 criterion 5 (d), (e), (ж): five bait files list three names and 'и ещё 2'; a bait file whose accepted name is too long is not named; the same beside a normally named bait file is counted",
  { timeout: 90_000 },
  async (t) => {
    const five = refusalProject(
      t,
      ["a.md", "b.md", "c.md", "d.md", "e.md"].map((n, i) => [
        n,
        bait(`${GHP}${fill(36, ALNUM.slice(i))}`),
      ]),
    );
    const fiveEvents = await runToEnd(t, five);
    assertRefusedWhole(five, fiveEvents, {
      baits: [],
      detail: `${SECRET_TEXT} (файлы: ${["a.md", "b.md", "c.md"].map(ACCEPTED).join(", ")} и ещё 2)`,
    });
    const long = `${"a".repeat(72)}.md`;
    assert.equal(long.length, 75);
    const alone = refusalProject(t, [[long, bait(BAIT_A)]]);
    assertRefusedWhole(alone, await runToEnd(t, alone), {
      baits: [BAIT_A],
      detail: SECRET_TEXT,
    });
    const beside = refusalProject(t, [
      [long, bait(BAIT_A)],
      ["named.md", bait(BAIT_B)],
    ]);
    assertRefusedWhole(beside, await runToEnd(t, beside), {
      baits: [BAIT_A, BAIT_B],
      detail: `${SECRET_TEXT} (файлы: ${ACCEPTED("named.md")} и ещё 1)`,
    });
  },
);

test(
  "RB-12 criterion 5: a file that the executor names twice is refused once and listed once in the text",
  { timeout: 60_000 },
  async (t) => {
    const p = refusalProject(t, [["x.md", bait(BAIT_A)]], ["x.md", "x.md"]);
    const events = await runToEnd(t, p);
    assertRefusedWhole(p, events, {
      baits: [BAIT_A],
      detail: `${SECRET_TEXT}${WITH(["x.md"])}`,
    });
  },
);

test("RB-12 criterion 5: secretDetail lists a repeated name once and gives the constant text for no names", () => {
  const same = ACCEPTED("x.md");
  assert.equal(secretDetail([same, same]), `${SECRET_TEXT} (файл: ${same})`);
  assert.equal(secretDetail([]), SECRET_TEXT);
  assert.equal(
    secretDetail([ACCEPTED("a.md"), ACCEPTED("b.md"), ACCEPTED("a.md")]),
    `${SECRET_TEXT} (файлы: ${ACCEPTED("a.md")}, ${ACCEPTED("b.md")})`,
  );
});

// The sets of names of criterion 5 (з)-(л): names that the rules of the journal change are
// never shown. A name in the form of a key is built from parts.
const KEY_NAME = `sk-${N(20)}.md`;
const NAME_CASES = [
  {
    id: "з REPORT.md",
    files: ["REPORT.md"],
    expect: `${SECRET_TEXT} (файл: t-0001-1-REPORT.md)`,
  },
  { id: "з app.test.js", files: ["app.test.js"], expect: SECRET_TEXT },
  { id: "з vendor.min.js", files: ["vendor.min.js"], expect: SECRET_TEXT },
  { id: "з notes.v2.md", files: ["notes.v2.md"], expect: SECRET_TEXT },
  { id: "и key-shaped name", files: [KEY_NAME], expect: SECRET_TEXT },
  {
    id: "к four files",
    files: ["REPORT.md", "app.test.js", KEY_NAME, "notes.v2.md"],
    expect: `${SECRET_TEXT} (файлы: t-0001-1-REPORT.md и ещё 3)`,
  },
  {
    id: "л bearer",
    files: ["bearer"],
    expect: `${SECRET_TEXT} (файл: t-0001-1-bearer)`,
  },
  {
    id: "л bearer and app.test.js",
    files: ["bearer", "app.test.js"],
    expect: SECRET_TEXT,
  },
];

test(
  "RB-12 criterion 5 (з)-(л), engine path: the event, the question and data.detail are one string, equal to the literal of the set of names; a name that the journal would change is not shown",
  { timeout: 120_000 },
  async (t) => {
    for (const c of NAME_CASES) {
      const p = refusalProject(
        t,
        c.files.map((n, i) => [n, bait(`${GHP}${fill(36, ALNUM.slice(i))}`)]),
      );
      const events = await runToEnd(t, p);
      try {
        assertRefusedWhole(p, events, { baits: [], detail: c.expect });
      } catch (err) {
        err.message = `${c.id}: ${err.message}`;
        throw err;
      }
      const texts = visibleTexts(p, events);
      for (const text of [texts.event, texts.question, texts.shown]) {
        if (c.expect === SECRET_TEXT) {
          for (const n of c.files)
            assert.equal(
              text.includes(n),
              false,
              `${c.id}: the name ${n} is shown`,
            );
        }
      }
    }
  },
);

// ---- RB-13: criterion 5 (c), the scripted executor ---------------------------------------------------

const MARK = "@@BAIT@@";

function scenarioWithBait(key) {
  const text = fs.readFileSync(
    path.join(FIXTURES, "scenario-secret.json"),
    "utf8",
  );
  assert.equal(text.includes(MARK), true);
  return Buffer.from(text.replace(MARK, key));
}

test(
  "RB-13 criterion 5 (c): run-task with the scripted executor and a note with the bait - exit 1, one clear line with the word 'секрет', no trace, no bait file in files/, the bait only in the byte copy of the scenario, the state in memory equals the state rebuilt from the journal, the process stays alive",
  { timeout: 60_000 },
  async (t) => {
    const sb = makeSandbox(t);
    const scenario = scenarioWithBait(BAIT_A);
    const p = makeProject(sb, {
      executor: "scripted",
      scenario_bytes: scenario,
    });
    const r = runTeam(["run-task", p.id, p.task], execEnv(sb));
    assert.equal(r.status, 1, r.stderr);
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      `E_TASK_FAILED: Задача не получилась: ${SECRET_TEXT} (файл: t-0001-1-note.md)\n`,
    );
    assert.doesNotMatch(r.stderr, /\n\s+at /u);
    assert.equal(r.stderr.split("\n").filter((l) => l !== "").length, 1);
    assert.equal(fs.existsSync(path.join(p.files, "t-0001-1-note.md")), false);
    const events = journal(p);
    assert.equal(ofType(events, "TASK_FAILED").length, 1);
    assert.equal(
      ofType(events, "TASK_FAILED")[0].data.detail,
      `${SECRET_TEXT} (файл: t-0001-1-note.md)`,
    );
    for (const { full, st } of walk(sb.home)) {
      if (!st.isFile()) continue;
      const holds = fs.readFileSync(full).includes(BAIT_A);
      assert.equal(holds, path.basename(full) === "scenario.json", full);
    }
    // the same scenario in this process: the state in memory is the rebuilt one
    const q = makeProject(sb, {
      executor: "scripted",
      scenario_bytes: scenario,
    });
    const env = execEnv(sb);
    assertSafeEnv(env);
    const w = openWriter(q.id, { home: sb.home });
    t.after(() => w.close());
    const result = await withLimit(
      runTask(w, q.task, { env, config: readConfig(env) }),
    );
    assert.equal(result.status, "failed");
    assert.deepStrictEqual(w.state, readProject(q.id, { home: sb.home }).state);
    assert.equal(w.broken, false);
  },
);

// ---- RB-19: criterion 5, the late refusal of acceptResult (claude-cli) --------------------------------

// A source that changes after the check of step 1 and before its write (remarks o32 and o33):
// the writer of the test rewrites the source file in work/ with a real-looking key just before
// the original importWorkFile runs (a seam in the process of the test, no change of the code).
// `at` is the number of the call that meets the changed source.
const LATE_CASES = [
  { at: 1, accepted: [] },
  { at: 2, accepted: ["first.md"] },
];

for (const { at, accepted } of LATE_CASES) {
  test(
    `RB-19 criterion 5 (late refusal, claude-cli): a source that changes before write number ${at} - the attempt ends with reason secret, the changed source is removed from work/, ${accepted.length === 0 ? "nothing is accepted" : "the file accepted before it stays"}, nothing else is written, the key is nowhere on disk, the state in memory equals the rebuilt state`,
    { timeout: 60_000 },
    async (t) => {
      const sb = makeSandbox(t);
      const names = ["first.md", "second.md"];
      writePlan(sb, {
        runs: [
          {
            stream: "stream-ok.jsonl",
            work_files: names.map((n) => ({
              path: n,
              content: `${keepText("O1#0")}\n`,
            })),
            answer_files: names,
          },
        ],
      });
      const p = makeProject(sb);
      const env = execEnv(sb);
      assertSafeEnv(env);
      const w = openWriter(p.id, { home: sb.home });
      t.after(() => w.close());
      const original = w.importWorkFile.bind(w);
      const seen = [];
      w.importWorkFile = (args) => {
        seen.push(args.path);
        if (seen.length === at) {
          // the source is checked clean at step 1; now it holds a key
          fs.writeFileSync(path.join(w.workDir, args.path), bait(BAIT_A));
        }
        return original(args);
      };
      const result = await withLimit(
        runTask(w, "t-0001", { env, config: readConfig(env) }),
      );
      const changed = names[at - 1];
      assert.equal(result.status, "failed");
      assert.equal(seen.length, at, "no write after the refused one");
      // the whole attempt is refused with the reason of a secret, named by the changed file
      const events = journal(p);
      assert.equal(ofType(events, "TASK_FAILED").length, 1);
      assert.equal(
        ofType(events, "TASK_FAILED")[0].data.detail,
        `${SECRET_TEXT}${WITH([changed])}`,
      );
      assert.equal(ofType(events, "TASK_FAILED")[0].data.reason, "result_file");
      assert.equal(ofType(events, "RUN_STARTED").length, 1, "no retry");
      // the source is gone from work/, the key is nowhere
      assert.equal(workOf(p).includes(changed), false, "the changed source");
      assert.deepEqual(FOUND(p.dir, BAIT_A), [], "the key is in the project");
      assert.deepEqual(FOUND(sb.user, BAIT_A), [], "the key is in the home");
      // the files accepted before it stay, exactly; nothing else is written
      assert.deepEqual(
        filesOf(p),
        accepted.map(ACCEPTED),
        "files/ holds only what was accepted before",
      );
      assert.deepEqual(
        ofType(events, "RESULT_FILE").map((e) => e.data.name),
        accepted.map(ACCEPTED),
      );
      for (const n of accepted) {
        const stored = fs.readFileSync(path.join(p.files, ACCEPTED(n)));
        assert.equal(sha256(stored), SHA["E:g-O1"], n);
      }
      assert.deepEqual(
        fs.readdirSync(p.files).filter((n) => n.startsWith(".")),
        [],
        "no partial file",
      );
      assert.equal(w.broken, false);
      assert.deepStrictEqual(
        w.state,
        readProject(p.id, { home: sb.home }).state,
        "the state in memory is the rebuilt state",
      );
      // the text for the user is the usual one: Russian, no key, no stack
      const detail = ofType(events, "TASK_FAILED")[0].data.detail;
      assert.match(detail, /секрет/u);
      assert.equal(detail.includes(LABEL), false);
    },
  );
}

// ---- RB-14: criterion 6, a task that only quotes an example key ----------------------------------------

const DOC_WITH_KEY = `# Документация\n\nПример настройки: ключ ${BAIT_A} подставьте свой.\nВерсия a.b.c\n`;

function runTaskWith(sb, p, over = {}) {
  return runTeam(["run-task", p.id, p.task], execEnv(sb, over));
}

test(
  "RB-14 criterion 6 (Q10): REPORT.md quotes an example key - run-task ends with code 1, an empty stdout and one clear line with 'секрет', no stack, one run, no retry; the journal only grows by whole lines, the next task works and is accepted byte for byte, the cost ceiling holds",
  { timeout: 60_000 },
  (t) => {
    const sb = makeSandbox(t);
    writePlan(sb, {
      runs: [
        {
          stream: "stream-ok.jsonl",
          work_files: [{ path: "REPORT.md", content: DOC_WITH_KEY }],
          answer_files: ["REPORT.md"],
        },
        {
          stream: "stream-ok.jsonl",
          work_files: [{ path: "o10.md", content: O10 }],
          answer_files: ["o10.md"],
        },
      ],
    });
    const p = makeProject(sb, { tasks: 2 });
    const before = fs.readFileSync(p.events);
    const r = runTeam(["run-task", p.id, "t-0001"], execEnv(sb));
    assert.equal(r.status, 1, r.stderr);
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      `E_TASK_FAILED: Задача не получилась: ${SECRET_TEXT} (файл: t-0001-1-REPORT.md)\n`,
    );
    assert.doesNotMatch(r.stderr, /\n\s+at /u);
    assert.equal(fakeStarts(sb).length, 1, "one run, no retry");
    const after = fs.readFileSync(p.events);
    assert.equal(
      sha256(after.subarray(0, before.length)),
      sha256(before),
      "the old bytes are the same",
    );
    const added = after.subarray(before.length).toString("utf8");
    assert.equal(added.endsWith("\n"), true, "whole lines only");
    const types = added
      .split("\n")
      .filter((l) => l !== "")
      .map((l) => JSON.parse(l).type);
    assert.ok(
      types.includes("RUN_STARTED") && types.includes("TASK_FAILED"),
      types.join(),
    );
    assert.equal(types.includes("RESULT_FILE"), false);
    assert.deepEqual(filesOf({ dir: p.dir }), []);
    assert.deepEqual(fs.readdirSync(p.work), []);
    assert.equal(allFilesText(sb.home).includes(BAIT_A), false);
    const view = runTeam(["project", p.id], execEnv(sb));
    const task = JSON.parse(view.stdout).project.tasks[0];
    assert.match(task.phrase, /секрет/u);
    // the next task of the same project works
    const next = runTeam(["run-task", p.id, "t-0002"], execEnv(sb));
    assert.equal(next.status, 0, next.stderr);
    const stored = fs.readFileSync(path.join(p.files, "t-0002-1-o10.md"));
    assert.equal(sha256(stored), SHA["E:o10"]);
    assert.ok(
      stateOf(sb, p.id).spent_usd <= 1,
      "the cost ceiling of the project",
    );
  },
);

test(
  "RB-14 criterion 6 (Q10), claude-cli path in the process of the test (remark F2): after the refusal for REPORT.md the state in memory equals the state that a new reading of events.jsonl builds (deepStrictEqual); the same writer then accepts the next task, and the two states are equal again",
  { timeout: 60_000 },
  async (t) => {
    const sb = makeSandbox(t);
    writePlan(sb, {
      runs: [
        {
          stream: "stream-ok.jsonl",
          work_files: [{ path: "REPORT.md", content: DOC_WITH_KEY }],
          answer_files: ["REPORT.md"],
        },
        {
          stream: "stream-ok.jsonl",
          work_files: [{ path: "o10.md", content: O10 }],
          answer_files: ["o10.md"],
        },
      ],
    });
    const p = makeProject(sb, { tasks: 2 });
    const env = execEnv(sb);
    assertSafeEnv(env);
    const config = readConfig(env);
    const w = openWriter(p.id, { home: sb.home });
    t.after(() => w.close());
    const lines = fs.readFileSync(p.events, "utf8").split("\n").length;
    const result = await withLimit(runTask(w, "t-0001", { env, config }));
    assert.equal(result.status, "failed");
    assert.ok(
      fs.readFileSync(p.events, "utf8").split("\n").length > lines,
      "the journal grew: the attempt and its failure are written",
    );
    assert.equal(ofType(journal(p), "RESULT_FILE").length, 0);
    assert.equal(ofType(journal(p), "TASK_FAILED").length, 1);
    assert.equal(w.broken, false);
    assert.deepStrictEqual(
      w.state,
      readProject(p.id, { home: sb.home }).state,
      "the state in memory is the rebuilt state after the refusal",
    );
    assert.deepEqual(filesOf({ dir: p.dir }), []);
    assert.equal(fakeStarts(sb).length, 1, "one run, no retry");
    // the writer is whole: the next task of the same process is accepted exactly
    const next = await withLimit(runTask(w, "t-0002", { env, config }));
    assert.equal(next.status, "review");
    const stored = fs.readFileSync(path.join(p.files, "t-0002-1-o10.md"));
    assert.equal(sha256(stored), SHA["E:o10"]);
    assert.deepStrictEqual(
      w.state,
      readProject(p.id, { home: sb.home }).state,
      "the state in memory is the rebuilt state after the next task",
    );
  },
);

test(
  "RB-14 criterion 5 (з)-(л), run-task path: the error line, the event and data.detail of the command events are one string equal to the literal of the set; a changed name is not printed on the console",
  { timeout: 120_000 },
  (t) => {
    for (const c of NAME_CASES) {
      const sb = makeSandbox(t);
      writePlan(sb, {
        default: {
          stream: "stream-ok.jsonl",
          work_files: c.files.map((n, i) => ({
            path: n,
            content: bait(`${GHP}${fill(36, ALNUM.slice(i))}`),
          })),
          answer_files: c.files,
        },
      });
      const p = makeProject(sb);
      const r = runTaskWith(sb, p);
      assert.equal(r.status, 1, `${c.id}: ${r.stderr}`);
      assert.equal(
        r.stderr,
        `E_TASK_FAILED: Задача не получилась: ${c.expect}\n`,
        c.id,
      );
      assert.equal(r.stderr.includes(LABEL), false, c.id);
      assert.equal(maskSecrets(c.expect), c.expect, c.id);
      const failed = ofType(journal(p), "TASK_FAILED");
      assert.equal(failed.length, 1, c.id);
      assert.equal(failed[0].data.detail, c.expect, c.id);
      const view = runTeam(["events", p.id], execEnv(sb));
      const shown = JSON.parse(view.stdout).events.find(
        (e) => e.type === "TASK_FAILED",
      );
      assert.equal(shown.data.detail, c.expect, c.id);
      assert.equal(ofType(journal(p), "RESULT_FILE").length, 0, c.id);
      assert.deepEqual(fs.readdirSync(p.files), [], c.id);
      assert.deepEqual(fs.readdirSync(p.work), [], c.id);
      assert.equal(
        allFilesText(sb.home).includes(GHP),
        false,
        `${c.id}: a bait is on disk`,
      );
      if (c.expect === SECRET_TEXT) {
        for (const n of c.files)
          assert.equal(
            r.stderr.includes(n),
            false,
            `${c.id}: ${n} on the console`,
          );
      }
    }
  },
);

// ---- RB-04: criterion 2 (b), the engine reads exactly ----------------------------------------------

// The engine takes at most 50 files from one run (RUN_FILES_MAX), so the groups O1-O35 go
// one file per group and the groups O36-O51 of the second rework go as one file.
const ENGINE_GROUPS = Object.keys(KEEP).filter(
  (g) => g !== "O9" && Number(g.slice(1)) <= 35,
);
const ENGINE_NEW = `${Object.keys(KEEP)
  .filter((g) => Number(g.slice(1)) > 35)
  .flatMap((g) => KEEP[g])
  .join("\n")}\n`;
const ENGINE_FILES = [
  ["o10.md", O10],
  ...ENGINE_GROUPS.map((g) => [`g-${g}.md`, groupFile(g)]),
  ["g-new.md", ENGINE_NEW],
  ...KEEP.O9.map((text, j) => [`o9-${j}.md`, text]),
];
const ENGINE_SHA = {
  "o10.md": SHA["E:o10"],
  ...Object.fromEntries(
    ENGINE_GROUPS.map((g) => [`g-${g}.md`, SHA[`E:g-${g}`]]),
  ),
  "g-new.md": SHA["E:g-new"],
  ...Object.fromEntries(
    KEEP.O9.map((_, j) => [`o9-${j}.md`, SHA[`E:o9-${j}`]]),
  ),
};

function twoTaskSpec(files) {
  return {
    goal: "Проект для проверки точного чтения файлов",
    tasks: [
      item("a", { done_when: `Файл сохранён в ${files[0][0]}.` }),
      item("b", {
        text: "МЕТКА-b прочитай результат первой",
        done_when: "Есть итог",
        depends_on: ["a"],
      }),
    ],
    work: [
      { files: files.map(([file, content]) => ({ path: file, content })) },
      { when: "МЕТКА-b", files: [] },
    ],
    reviewTask: true,
    goalScript: [{ passed: true, notes: "Цель достигнута" }],
  };
}

const stdinsOf = (p, purpose) =>
  p
    .log()
    .filter((l) => l.purpose === purpose)
    .map((l) => p.stdins().find((s) => s.n === l.n).text);

test(
  "RB-04 criterion 2 (b): the check of the task, the check of the goal and the dependent task get the samples of the groups O exactly, no label; the journal holds the literal sha256; work/ is empty",
  { timeout: 120_000 },
  async (t) => {
    const p = readsProject(t, twoTaskSpec(ENGINE_FILES));
    const events = await runToEnd(t, p);
    assert.equal(
      ofType(events, "PROJECT_DONE").length,
      1,
      JSON.stringify(ofType(events, "TASK_FAILED")),
    );
    const stored = ofType(events, "RESULT_FILE");
    assert.equal(stored.length, ENGINE_FILES.length);
    for (const e of stored) {
      const name = e.data.name.replace(/^t-0001-1-/u, "");
      assert.equal(e.data.sha256, ENGINE_SHA[name], name);
    }
    assert.deepEqual(workOf(p), [], "work/ is empty");
    const readers = [
      [
        "the check of the task",
        stdinsOf(p, "review").filter((s) => s.includes("t-0001-1-o10.md")),
      ],
      ["the check of the goal", stdinsOf(p, "goal_check")],
      [
        "the dependent task",
        p
          .stdins()
          .map((s) => s.text)
          .filter(
            (s) => s.includes("МЕТКА-b") && s.includes("t-0001-1-o10.md"),
          ),
      ],
    ];
    for (const [who, inputs] of readers) {
      assert.ok(inputs.length >= 1, `${who}: no run`);
      for (const input of inputs) {
        assert.equal(
          input.includes(LABEL),
          false,
          `${who}: a label in the input`,
        );
        for (const [name, text] of ENGINE_FILES) {
          assert.equal(
            input.includes(text),
            true,
            `${who}: ${name} is not exact`,
          );
        }
      }
    }
    for (const s of p.stdins()) assert.equal(s.text.includes(LABEL), false);
  },
);

test(
  "RB-05 criterion 2 (c), engine: a file over the limit of a request is accepted byte for byte; the input of the check holds its first 1000 characters exactly, then the visible mark of the cut, and no label",
  { timeout: 90_000 },
  async (t) => {
    assert.ok(LONG.length > 200_000);
    const p = readsProject(t, {
      goal: "Проект для проверки длинного файла",
      tasks: [item("a", { done_when: "Файл сохранён в long.md." })],
      work: [{ files: [{ path: "long.md", content: LONG }] }],
      reviewTask: true,
      goalScript: [{ passed: true, notes: "Хорошо" }],
    });
    const events = await runToEnd(t, p);
    const stored = ofType(events, "RESULT_FILE");
    assert.equal(stored.length, 1);
    assert.equal(stored[0].data.sha256, SHA["E:long"]);
    assert.equal(stored[0].data.bytes, LONG.length);
    const first = LONG.slice(0, 1000);
    const inputs = stdinsOf(p, "review").filter((s) =>
      s.includes("t-0001-1-long.md"),
    );
    assert.ok(inputs.length >= 1);
    for (const input of inputs) {
      const at = input.indexOf(first);
      assert.ok(at >= 0, "the beginning of the file is exact");
      assert.ok(input.indexOf("[обрезано]", at) > at, "the cut is marked");
      assert.equal(input.includes(LABEL), false);
      assert.equal(
        input.includes(LONG),
        false,
        "the file is cut in the request",
      );
    }
  },
);

// ---- RB-17: criterion 11, the documents and the records ----------------------------------------------

// The number of lines that hold the text (as `grep -c`); `ci` ignores the case (`grep -ci`).
const grepC = (text, needle, ci = false) => {
  const want = ci ? needle.toLowerCase() : needle;
  return text
    .split("\n")
    .filter((l) => (ci ? l.toLowerCase() : l).includes(want)).length;
};

test("RB-17 criterion 11 (a): the README of tools names the byte-exact storage, findSecrets, the reason secret, the placeholders, the residual risks and the false refusals, and no longer says that the content is masked", () => {
  const readme = fs.readFileSync(path.join(TOOLS_DIR, "README.md"), "utf8");
  assert.equal(grepC(readme, "content of result files pass through"), 0);
  assert.equal(grepC(readme, "the content is masked"), 0);
  assert.ok(grepC(readme, "byte-exact") >= 1);
  assert.ok(grepC(readme, "findSecrets") >= 1);
  assert.ok(grepC(readme, "reason `secret`") >= 1);
  const work = readme.split("\n").filter((l) => l.startsWith("- `work/`"));
  assert.ok(work.length >= 1);
  assert.equal(grepC(work.join("\n"), "already masked"), 0);
  const risk = readme.split("\n").filter((l) => l.includes("findSecrets"));
  assert.ok(grepC(risk.join("\n"), "residual risk", true) >= 1);
  assert.ok(grepC(readme, "placeholder") >= 1);
  assert.ok(grepC(readme, "false refusal", true) >= 1);
  for (const words of [
    "space before the sign",
    "address with no user",
    "not scanned inside",
  ]) {
    assert.ok(grepC(readme, words) >= 1, words);
  }
  // the lines that TM-50 and DC-01 look for are in place
  for (const line of [
    "the names of result files are not masked",
    "binary ones are rejected",
    "looks like a key",
  ]) {
    assert.ok(grepC(readme, line, true) >= 1, line);
  }
});

test("RB-17 criterion 11 (b): a decision record other than 0102 holds the findSecrets rules, the residual risks and the quotations of the replaced sentences; it has a row in decisions/README.md", () => {
  const dir = path.join(REPO_ROOT, "decisions");
  const names = fs.readdirSync(dir).filter((n) => n.endsWith(".md"));
  const holders = names.filter(
    (n) =>
      !n.startsWith("0102-") &&
      fs.readFileSync(path.join(dir, n), "utf8").includes("findSecrets"),
  );
  assert.ok(
    holders.includes("0105-result-files-byte-exact-findsecrets.md"),
    holders.join(),
  );
  const record = fs.readFileSync(
    path.join(dir, "0105-result-files-byte-exact-findsecrets.md"),
    "utf8",
  );
  for (const needle of ["M10", "work/", "P9", "0035", "M7", "authHeader"]) {
    assert.ok(grepC(record, needle) >= 1, needle);
  }
  for (const needle of [
    "residual risk",
    "placeholder",
    "scripted",
    "false refusal",
    "expression",
    "Authorization",
    "owner",
  ]) {
    assert.ok(grepC(record, needle, true) >= 1, needle);
  }
  assert.ok(grepC(record, "wrong-password") >= 1);
  assert.ok(grepC(record, "попадает только маскированное") >= 1);
  assert.ok(grepC(record, "они уже маскированы") >= 1);
  const index = fs.readFileSync(path.join(dir, "README.md"), "utf8");
  assert.ok(grepC(index, "0105-result-files-byte-exact-findsecrets.md") >= 1);
});

// The block of a requirement as the awk of the criterion cuts it.
function blockOf(lines, id) {
  const start = lines.indexOf(`  - id: ${id}`);
  assert.ok(start >= 0, id);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("  - id: ")) {
      end = i;
      break;
    }
  }
  return { start, text: lines.slice(start, end).join("\n") };
}

test("RB-17 criterion 11 (c): the micro-amendments of REQ-009, REQ-010 and REQ-013 are made - the old phrases are gone from their blocks and a dated 'was - became' line (a time stamp, the run id, the words) stands above each block", () => {
  const lines = fs
    .readFileSync(path.join(REPO_ROOT, "docs", "requirements.yaml"), "utf8")
    .split("\n");
  const cases = [
    ["REQ-009", "файлы результатов — после"],
    ["REQ-010", "образец секрета в нём"],
    ["REQ-013", "получатель видит"],
  ];
  for (const [id, phrase] of cases) {
    const { start, text } = blockOf(lines, id);
    assert.equal(
      grepC(text, phrase),
      0,
      `${id}: the old phrase is still there`,
    );
    const note = lines[start - 1];
    assert.match(note, /^\s*#/u, id);
    // dated: a time of the form 2026-10-28T04:54:25Z right after the hash sign
    assert.match(
      note,
      /^\s*#\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/u,
      `${id}: the note is dated`,
    );
    assert.ok(note.includes("ISS-0093-20261028-01"), id);
    assert.ok(note.includes("было") && note.includes("стало"), id);
  }
});

// ---- RB-18: criteria 9 and 12, the guard tests are not deleted or weakened ------------------------------------

const GUARDS = [
  ["TM-57", "team-store", 4],
  ["TM-58", "team-store", 2],
  ["TM-63", "team-store", 3],
  ["RF-03", "team-engine-reads-files", 1],
  ["SF-13", "team-engine-rounds", 1],
  ["SF-10", "team-engine-rounds", 1],
  ["SF-11", "team-engine-rounds", 1],
  ["SF-12", "team-engine-rounds", 1],
  ["SF-15", "team-engine-rounds", 1],
  ["TM-43", "team-journal", 2],
  ["EX-41", "exec-workdir", 2],
  ["EX-51", "exec-scripted-source", 5],
];
const ASSERT_FLOORS = {
  "team-store": 203,
  "team-engine-reads-files": 113,
  "team-engine-rounds": 60,
  "team-journal": 79,
  "exec-workdir": 63,
  "exec-scripted-source": 34,
};

test("RB-18 criterion 9: the twelve guard tests are all there (title lines per id and the number of assert lines are not below the values of the base), and none of the six files has skip, todo or only", () => {
  const testsDir = path.dirname(THIS_FILE);
  const text = (name) =>
    fs.readFileSync(path.join(testsDir, `${name}.test.js`), "utf8");
  assert.equal(GUARDS.length, 12);
  assert.equal(
    GUARDS.reduce((sum, g) => sum + g[2], 0),
    24,
  );
  for (const [id, file, floor] of GUARDS) {
    const titles = text(file)
      .split("\n")
      .filter(
        (l) =>
          (l.startsWith('test("') || l.startsWith('  "')) &&
          new RegExp(`^(test\\()?\\s*"${id}[ :]`, "u").test(l),
      );
    assert.ok(titles.length >= floor, `${id}: ${titles.length} < ${floor}`);
  }
  for (const [file, floor] of Object.entries(ASSERT_FLOORS)) {
    const body = text(file);
    const asserts = body
      .split("\n")
      .filter((l) => !/^\s*(\/\/|[*])/u.test(l) && l.includes("assert")).length;
    assert.ok(asserts >= floor, `${file}: ${asserts} < ${floor}`);
    assert.doesNotMatch(
      body,
      /[.]skip[(]|[.]todo[(]|[.]only[(]|[{] ?(skip|todo)/u,
      file,
    );
  }
});

test("RB-18 criterion 12: the single-run helper has no use of the check (no common helper, decisions/0102 item 5) and the package of tools has no runtime dependencies", () => {
  const single = fs.readFileSync(
    path.join(TEAM_SRC, "engine", "single-run.js"),
    "utf8",
  );
  assert.equal(single.includes("findSecrets"), false);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS_DIR, "package.json"), "utf8"),
  );
  assert.equal(Object.hasOwn(pkg, "dependencies"), false);
});
