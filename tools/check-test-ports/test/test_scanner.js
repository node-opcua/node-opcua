/**
 * Unit tests for the port scanner.
 *
 * The fixtures below are not invented: each one reproduces a pattern found in this
 * repo's own test suite while chasing the EADDRINUSE that took master red. The
 * false-positive fixtures matter just as much as the positive ones - an early version of
 * this scanner flagged `transportTimeout` as a port, because "transport" contains "port".
 *
 * Run: node test/test_scanner.js   (node:test needs no --test flag, and ignores extra argv)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyze, suggest, exitCode, strictExitCode, formatReport, formatSummary, formatAiPrompt, portBlocks, isReserved, EPHEMERAL_FLOOR } from "../src/scanner.js";

/** every pattern the real suite turned out to contain */
const FIXTURES = {
    // --- the convention, in the shapes the repo actually uses --------------------
    "packages/pkg-a/test/proper.ts": `
const port = 5100;
describe("proper", () => {
    it("works", async () => { await startServer({ port }); });
});
`,
    "packages/pkg-a/test/numbered.ts": `
const port1 = 5101;
const port2 = 5102;
const port3 = 5103;
`,
    "packages/pkg-a/test/named_variants.ts": `
const serverPort = 5104;
const reverseListenPort = 5105;
const proxyPort = 5106;
const port_discovery = 5107;
`,

    // --- a collision across two files: what actually broke the build --------------
    "packages/pkg-b/test/collides_with_proper.ts": `
const port = 5100;
`,

    // --- the convention violated: a literal inside an options object --------------
    "packages/pkg-b/test/inline_option.ts": `
before(async () => {
    handle = await startSampleServer({ port: 5108 });
});
`,
    "packages/pkg-b/test/inline_listen.ts": `
server.listen(5109, () => done());
`,

    // --- non-determinism: the OS chooses, so a failure names nothing --------------
    "packages/pkg-c/test/dynamic.js": `
server.listen(0, "127.0.0.1", () => resolve());
const options = { port: 0 };
`,

    // --- a fixed port inside the ephemeral range: stealable by any listen(0) ------
    "packages/pkg-c/test/ephemeral.ts": `
const port = 48561;
`,

    // --- must NOT be read as ports ------------------------------------------------
    // "transportTimeout" contains "port"; an early version of this scanner flagged it.
    "packages/pkg-c/test/false_positives.ts": `
const transportTimeout = 30000;
const supportedVersion = 4840;
const reportInterval = 9999;
const timeout = 20000;
const maxMessageSize = 8192;
const exportCount = 5555;
`,
    // below 1024 is privileged; the suite never pins one, and these are usually
    // protocol constants rather than something a test binds
    "packages/pkg-c/test/privileged.ts": `
const port = 443;
`,

    // --- two ports in ONE file is fine: that file runs in a single process --------
    "packages/pkg-d/test/two_in_one_file.ts": `
const portA = 5200;
const portB = 5200;
`,

    // --- a counter whose name ends in "Port", initialised to zero -----------------
    // Real: test_advertised_endpoints.ts declares `let matchingListenPort = 0` and
    // increments it in a loop. An earlier scanner called it a port-0 bind, and the
    // --ai prompt duly proposed replacing the 0 with a port number.
    "packages/pkg-d/test/counter_not_a_port.ts": `
let matchingListenPort = 0;
for (const e of endpoints) { if (e.url.includes(":5100")) { matchingListenPort++; } }
`,

    // --- a port derived from another: invisible to any scanner --------------------
    // Real: test_advertised_endpoints.ts declares `const port = 12061` and then binds
    // `port + 1`. 12062 is bound as surely as if written down, but appears nowhere.
    "packages/pkg-e/test/derived.ts": `
const port = 5300;
const sanPort = 5310;
await startServer({ port: port + 1 });
await createServerCertificateManager(sanPort + 2);
// port+=1;  <- commented out, binds nothing
let matchingListenPort = 0;
matchingListenPort++;
`,

    // a file claiming, as a plain literal, the port that pkg-e derives - invisible
    // before derived values were resolved, so the two looked distinct and were not
    "packages/pkg-f/test/claims_derived_value.ts": `
const port = 5301;
`,

    // a deliberate probe, declaring itself. Real: findAvailablePort, the
    // guaranteed-closed endpoint, and the leak-detector fixtures all need listen(0).
    "packages/pkg-g/test/deliberate_probe.ts": `
// check-test-ports: dynamic-ok - asks the OS for a free port, then closes it
server.listen(0);
const probe = { port: 0 };  // check-test-ports: dynamic-ok - same line works too
`,

    // TypeScript lets the type sit between name and value. Missing this reads as a
    // file that binds nothing, which looks like a clean result rather than a gap.
    "packages/pkg-h/test/typed_declaration.ts": `
const port: number = 5400;
let otherPort: number = 5401;
`,

    // --- directories the scanner must ignore --------------------------------------
    "packages/pkg-d/test/node_modules/dep/index.js": `const port = 5100;`,
    "packages/pkg-d/dist/test/compiled.js": `const port = 5100;`
};

function makeFixtureRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-test-ports-"));
    for (const [rel, content] of Object.entries(FIXTURES)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }
    return root;
}

const root = makeFixtureRoot();
const result = analyze(root);
const portsOf = (file) => [...result.ports.entries()].filter(([, m]) => m.has(file)).map(([p]) => p);

test("finds ports declared the conventional way", () => {
    assert.ok(result.ports.has(5100), "const port = 5100");
    assert.deepEqual(portsOf("packages/pkg-a/test/numbered.ts").sort(), [5101, 5102, 5103]);
});

test("reads a declaration that carries a type annotation", () => {
    assert.deepEqual(portsOf("packages/pkg-h/test/typed_declaration.ts").sort(), [5400, 5401]);
});

test("recognises every port-naming variant the repo uses", () => {
    assert.deepEqual(portsOf("packages/pkg-a/test/named_variants.ts").sort(), [5104, 5105, 5106, 5107]);
});

test("reports a port claimed by two files as a collision", () => {
    const collided = result.collisions.map(([p]) => p);
    assert.ok(collided.includes(5100));
    const byFile = result.ports.get(5100);
    assert.deepEqual([...byFile.keys()].sort(), [
        "packages/pkg-a/test/proper.ts",
        "packages/pkg-b/test/collides_with_proper.ts"
    ]);
});

test("does not call two ports in one file a collision", () => {
    // both 5200 declarations live in one file, which runs in one process
    assert.ok(result.ports.has(5200));
    assert.equal(result.ports.get(5200).size, 1);
    assert.ok(!result.collisions.some(([p]) => p === 5200));
});

test("flags a port literal written outside a declaration", () => {
    const flagged = result.inline.map((d) => d.port).sort();
    assert.deepEqual(flagged, [5108, 5109]);
});

test("honours the dynamic-ok marker, on the line above or the same line", () => {
    const flagged = result.dynamic.filter((d) => d.rel === "packages/pkg-g/test/deliberate_probe.ts");
    assert.deepEqual(flagged, [], "a marked probe is a considered exception, not a finding");
});

test("flags port 0 wherever it appears", () => {
    // once as listen(0), once as { port: 0 } - both in the same fixture
    assert.equal(result.dynamic.length, 2);
    assert.ok(result.dynamic.every((d) => d.rel === "packages/pkg-c/test/dynamic.js"));
});

test("flags a port derived from a declared one", () => {
    const derived = result.computed.filter((c) => c.rel === "packages/pkg-e/test/derived.ts");
    assert.deepEqual(derived.map((c) => c.name).sort(), ["port", "sanPort"]);
});

test("resolves a derived port to the number it actually binds", () => {
    const derived = result.computed.filter((c) => c.rel === "packages/pkg-e/test/derived.ts");
    const byName = Object.fromEntries(derived.map((c) => [c.name, c.resolved]));
    assert.equal(byName.port, 5301, "port(5300) + 1");
    assert.equal(byName.sanPort, 5312, "sanPort(5310) + 2");
});

test("counts a derived port as occupied, so it can collide", () => {
    // pkg-e binds 5301 as `port + 1`; pkg-f writes 5301 down. Before derived values
    // were resolved the report called this clean, which is exactly the blind spot.
    assert.ok(result.ports.has(5301));
    const collided = result.collisions.map(([p]) => p);
    assert.ok(collided.includes(5301), "a derived port must be able to collide");
});

test("does not flag a commented-out derivation, nor a counter", () => {
    const derived = result.computed.filter((c) => c.rel === "packages/pkg-e/test/derived.ts");
    assert.ok(!derived.some((c) => c.text.startsWith("//")), "a commented line binds nothing");
    // matchingListenPort is never declared as a port constant, so it is a counter
    assert.ok(!derived.some((c) => c.name === "matchingListenPort"), "counters are not ports");
});

test("does not treat a zero-initialised counter as a port 0 bind", () => {
    assert.ok(
        !result.dynamic.some((d) => d.rel === "packages/pkg-d/test/counter_not_a_port.ts"),
        "`let matchingListenPort = 0` is a counter, not a bind"
    );
});

test("flags a fixed port inside the ephemeral range", () => {
    assert.deepEqual(result.unsafe, [48561]);
    assert.ok(48561 >= EPHEMERAL_FLOOR);
});

test("does not mistake other numeric constants for ports", () => {
    // transportTimeout, supportedVersion, reportInterval, exportCount all contain "port"
    assert.deepEqual(portsOf("packages/pkg-c/test/false_positives.ts"), []);
    for (const n of [30000, 4840, 9999, 20000, 8192, 5555]) {
        assert.ok(!result.ports.has(n), `${n} must not be read as a port`);
    }
});

test("ignores privileged ports below 1024", () => {
    assert.ok(!result.ports.has(443));
});

test("ignores node_modules and dist", () => {
    const files = [...result.ports.values()].flatMap((m) => [...m.keys()]);
    assert.ok(!files.some((f) => f.includes("node_modules")), "node_modules must not be scanned");
    assert.ok(!files.some((f) => f.includes("/dist/")), "dist must not be scanned");
});

test("suggests ports that extend an existing block, keeping the footprint compact", () => {
    // the fixtures cluster around 5100-5107; a suggestion should grow that cluster
    // rather than opening a new one far away, so the summary stays scannable
    const before = portBlocks(result.ports).length;
    const free = suggest(result.ports, 4);
    const grown = new Map(result.ports);
    for (const p of free) {
        grown.set(p, new Map());
    }
    assert.ok(portBlocks(grown).length <= before + 1, "at most one new block should appear");
});

test("never suggests a port that belongs to somebody else", () => {
    // 4840 is OPC UA's own registered port and 5000 is macOS AirPlay - a test pinned
    // there passes in CI and fails on a developer's machine, which is the worst place
    // for a failure to appear. suggest() picked 5000 before this existed.
    assert.ok(isReserved(4840), "OPC UA TCP");
    assert.ok(isReserved(4843), "OPC UA HTTPS");
    assert.ok(isReserved(5000), "macOS AirPlay / flask");
    assert.ok(isReserved(26550), "inside the vendor OPC UA range");
    assert.ok(!isReserved(5780), "an ordinary free port");
    for (const p of suggest(result.ports, 25)) {
        assert.ok(!isReserved(p), `${p} belongs to somebody else`);
    }
});

test("suggests free ports outside the ephemeral range", () => {
    const free = suggest(result.ports, 3);
    assert.equal(free.length, 3);
    for (const p of free) {
        assert.ok(!result.ports.has(p), `${p} is already taken`);
        assert.ok(p < EPHEMERAL_FLOOR, `${p} is stealable`);
        assert.ok(p >= 1024);
    }
});

test("fails the build on a collision, but only on a collision", () => {
    assert.equal(exitCode(result), 1);
    const clean = { collisions: [], unsafe: [1], inline: [1], dynamic: [1] };
    assert.equal(exitCode(clean), 0, "warnings alone must not block adding a test");
});

test("renders a report naming the file and line of each finding", () => {
    const report = formatReport(result);
    assert.match(report, /5100/);
    assert.match(report, /packages\/pkg-a\/test\/proper\.ts/);
    assert.match(report, /free port\(s\) to move one side onto/);
    assert.match(report, /outside a declaration/);
    assert.match(report, /use\(s\) of port 0/);
});

test("says so plainly when a tree is clean", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "check-test-ports-clean-"));
    fs.mkdirSync(path.join(empty, "packages/pkg/test"), { recursive: true });
    fs.writeFileSync(path.join(empty, "packages/pkg/test/a.ts"), "const port = 5100;\n");
    const clean = analyze(empty);
    assert.equal(exitCode(clean), 0);
    assert.match(formatReport(clean), /no collisions/);
    fs.rmSync(empty, { recursive: true, force: true });
});

test("the --ai prompt states the convention and every task", () => {
    const p = formatAiPrompt(result);
    assert.match(p, /CONVENTION/);
    assert.match(p, /const port = /);
    // matched on what each task says, not its number - renumbering is not a regression
    assert.match(p, /TASK \d+ - reassign/);
    assert.match(p, /TASK \d+ - hoist/);
    assert.match(p, /TASK \d+ - name \d+ derived port/);
    assert.match(p, /TASK \d+ - replace \d+ use\(s\) of port 0/);
    assert.match(p, /Leave listen\(0\) alone where it is a probe/);
    assert.match(p, /VERIFY/);
    assert.match(p, /pnpm run check:ports/);
});

test("the --ai prompt names each file with its old and new port", () => {
    const p = formatAiPrompt(result);
    // the second claimant of 5100 moves; the first keeps it
    assert.match(p, /packages\/pkg-b\/test\/collides_with_proper\.ts/);
    assert.match(p, /5100 -> \d+/);
    assert.match(p, /48561 -> \d+/);
    assert.match(p, /collides with packages\/pkg-a\/test\/proper\.ts/);
});

test("the --ai prompt allocates ports itself, never reusing a taken one", () => {
    // Two passes each picking "the next free port" independently would recreate the
    // collisions this tool exists to catch, so the prompt hands out concrete numbers.
    const assigned = [...formatAiPrompt(result).matchAll(/-> (\d+)/g)].map((m) => Number(m[1]));
    assert.ok(assigned.length > 0);
    assert.equal(new Set(assigned).size, assigned.length, "assignments must be distinct");
    for (const p of assigned) {
        assert.ok(!result.ports.has(p), `${p} is already used by the suite`);
        assert.ok(p < EPHEMERAL_FLOOR && p >= 1024, `${p} is not a safe fixed port`);
    }
});

test("collapses occupied ports into blocks, merging near neighbours", () => {
    const blocks = portBlocks(new Map([[5100, 0], [5101, 0], [5104, 0], [9000, 0]].map(([k]) => [k, new Map()])));
    assert.equal(blocks.length, 2, "5100-5104 are near neighbours; 9000 is not");
    assert.deepEqual([blocks[0].start, blocks[0].end], [5100, 5104]);
    assert.deepEqual([blocks[1].start, blocks[1].end], [9000, 9000]);
});

test("the summary shows the occupied range so a local service can be ruled out", () => {
    const s = formatSummary(result);
    assert.match(s, /ports occupied - \d+-\d+, \d+ block\(s\), \d+ port\(s\)/);
    assert.match(s, /may be a local service rather than the suite/);
});

test("the strict gate refuses doubt, not only failure", () => {
    // this fixture tree has collisions, inline literals and a derived port
    assert.equal(strictExitCode(result), 1);
    assert.equal(strictExitCode({ collisions: [], unsafe: [], inline: [], dynamic: [], computed: [], ports: new Map() }), 0);
});

test.after(() => fs.rmSync(root, { recursive: true, force: true }));

// --- numeric separators and configurable roots ---------------------------------------
//
// Added when the scanner was lifted out of this repo. A consumer formatting numbers with
// `30_795` (biome and prettier both leave them alone) was invisible to the old patterns,
// so two files sharing 30_795 reported no collision at all.

/** a throwaway tree holding the given files, relative to its root */
function tempTree(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-test-ports-opts-"));
    for (const [rel, content] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }
    return dir;
}

test("a port written with numeric separators is a port, and collides like one", () => {
    const dir = tempTree({
        "packages/a/tests/one.test.ts": "const GDS_PORT = 30_795;\nconst port2: number = 30_796;\n",
        "packages/b/tests/two.test.ts": "const port = 30795;\n"
    });
    const r = analyze(dir);
    assert.ok(r.ports.has(30795), "30_795 read as 30795");
    assert.ok(r.ports.has(30796), "a typed declaration with a separator");
    assert.deepEqual(r.collisions.map(([p]) => p), [30795]);
    assert.equal(exitCode(r), 1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("separators are read in inline literals and listen() calls too", () => {
    const dir = tempTree({
        "packages/a/tests/inline.test.ts": "start({ port: 31_001 });\nserver.listen(31_002);\n"
    });
    const r = analyze(dir);
    assert.deepEqual([...r.ports.keys()].sort(), [31001, 31002]);
    assert.equal(r.inline.length, 2);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("a literal offset written with a separator still resolves", () => {
    const dir = tempTree({ "packages/a/tests/derived.test.ts": "const port = 32_000;\nstart({ port: port + 1_0 });\n" });
    const r = analyze(dir);
    assert.ok(r.ports.has(32010), "port + 1_0 binds 32010");
    fs.rmSync(dir, { recursive: true, force: true });
});

test("packageRoots and testDirs decide what is scanned", () => {
    const dir = tempTree({
        "libs/a/spec/one.ts": "const port = 6100;\n",
        "libs/b/spec/two.ts": "const port = 6100;\n",
        "packages/c/test/three.ts": "const port = 6200;\n"
    });
    const defaults = analyze(dir);
    assert.deepEqual([...defaults.ports.keys()], [6200], "the defaults look at packages/*/test only");
    const custom = analyze(dir, { packageRoots: ["libs"], testDirs: ["spec"] });
    assert.deepEqual([...custom.ports.keys()], [6100]);
    assert.equal(custom.collisions.length, 1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("the command line takes --root, --package-roots and --test-dirs, and the package.json key", async () => {
    const { execFileSync, spawnSync } = await import("node:child_process");
    const cli = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../src/index.js");
    const dir = tempTree({
        "libs/a/spec/one.ts": "const port = 6100;\n",
        "libs/b/spec/two.ts": "const port = 6100;\n"
    });
    const viaFlags = spawnSync(process.execPath, [cli, "--root", dir, "--package-roots", "libs", "--test-dirs", "spec"], { encoding: "utf8" });
    assert.equal(viaFlags.status, 1, "a collision exits 1");
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ checkTestPorts: { packageRoots: ["libs"], testDirs: ["spec"] } }));
    const viaConfig = spawnSync(process.execPath, [cli, "--root", dir], { encoding: "utf8" });
    assert.equal(viaConfig.status, 1, "the package.json key configures the same scan");
    const blind = execFileSync(process.execPath, [cli, "--root", dir, "--package-roots", "packages"], { encoding: "utf8" });
    assert.match(blind, /no collisions/, "a flag overrides the key");
    fs.rmSync(dir, { recursive: true, force: true });
});

// --- false negatives found applying the gate to another repository -----------------
//
// Each of these made a file that really binds fixed ports report clean. One of them hid a
// real TCP collision: `TEST_PORT + 1` in one file equalled `TEST_PORT` in another.

test("a class field is a declaration, whatever its modifiers", () => {
    const dir = tempTree({
        "packages/a/test/fields.ts": `
class Fixture {
    public readonly sourcePort = 7101;
    readonly targetPort = 7102;
    private static port: number = 7103;
    static otherPort = 7104;
    #hiddenPort = 7105;
    protected override destPort = 7106;
}
`,
        "packages/b/test/same.ts": "const port = 7101;\n"
    });
    const r = analyze(dir);
    assert.deepEqual([...r.ports.keys()].sort(), [7101, 7102, 7103, 7104, 7105, 7106]);
    assert.deepEqual(r.inline, [], "a declared field is not an inline literal");
    assert.deepEqual(r.collisions.map(([p]) => p), [7101]);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("an assignment that is not a declaration is reported, not ignored", () => {
    const dir = tempTree({
        "packages/a/test/assign.ts": `
class Fixture {
    listenPort = 7201;
    constructor() { this.port = 7202; }
}
options.serverPort = 7203;
`
    });
    const r = analyze(dir);
    assert.deepEqual(r.inline.map((d) => d.port).sort(), [7201, 7202, 7203]);
    assert.deepEqual([...r.ports.keys()].sort(), [7201, 7202, 7203], "still counted, so still collides");
    fs.rmSync(dir, { recursive: true, force: true });
});

test("class fields and assignments that are not ports stay unmatched", () => {
    const dir = tempTree({
        "packages/a/test/near_miss.ts": `
class Fixture {
    readonly transportTimeout = 30000;
    private reportInterval = 9999;
    static exportCount = 5555;
    public readonly supportedVersion = 4840;
    private matchingListenPort = 0;
}
matchingListenPort = 0;
if (port === 7301) {}
if (port == 7302) {}
const f = port => 7303;
`
    });
    const r = analyze(dir);
    assert.deepEqual([...r.ports.keys()], []);
    assert.deepEqual(r.inline, []);
    assert.deepEqual(r.dynamic, [], "a zero-initialised counter field or reset is not a port 0 bind");
    fs.rmSync(dir, { recursive: true, force: true });
});

test("a readonly field set to zero is a dynamic port, like a const", () => {
    const dir = tempTree({ "packages/a/test/zero.ts": "class F {\n    readonly port = 0;\n}\n" });
    assert.equal(analyze(dir).dynamic.length, 1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("a port derived from an UPPER_CASE constant is resolved and can collide", () => {
    const dir = tempTree({
        "packages/a/test/compression.ts": `
const TEST_PORT = 7401;
const BASE_PORT = 7410;
const config = {
    transport: { type: "tcp", port: TEST_PORT + 1 },
    other: { port: 1 + BASE_PORT }
};
`,
        "packages/b/test/encryption.ts": "const TEST_PORT = 7402;\n"
    });
    const r = analyze(dir);
    const derived = r.computed.filter((c) => c.rel === "packages/a/test/compression.ts");
    assert.deepEqual(derived.map((c) => [c.name, c.resolved]).sort(), [["BASE_PORT", 7411], ["TEST_PORT", 7402]]);
    assert.deepEqual(r.collisions.map(([p]) => p), [7402], "TEST_PORT + 1 collides with the other file's TEST_PORT");
    fs.rmSync(dir, { recursive: true, force: true });
});

test("UPPER_CASE constants that are not ports are not derivations", () => {
    const dir = tempTree({
        "packages/a/test/near_miss.ts": `
const TRANSPORT_TIMEOUT = 3000;
const REPORT_INTERVAL = 9999;
const EXPORT_COUNT = 5555;
wait(TRANSPORT_TIMEOUT + 1);
wait(REPORT_INTERVAL - 1);
wait(1 + EXPORT_COUNT);
`
    });
    const r = analyze(dir);
    assert.deepEqual([...r.ports.keys()], []);
    assert.deepEqual(r.computed, []);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("a port name may carry a numeric suffix after Port", () => {
    const dir = tempTree({
        "packages/a/test/cases.ts": `
const case1Port1 = 7501;
const case1Port2: number = 7502;
const TEST_PORT_2 = 7503;
start({ port: case1Port1 + 10 });
`,
        "packages/b/test/other.ts": "const port = 7511;\n"
    });
    const r = analyze(dir);
    assert.deepEqual([...r.ports.keys()].sort(), [7501, 7502, 7503, 7511]);
    assert.deepEqual(r.collisions.map(([p]) => p), [7511], "case1Port1 + 10 binds 7511");
    fs.rmSync(dir, { recursive: true, force: true });
});

test("a numeric suffix does not let non-port names in", () => {
    const dir = tempTree({
        "packages/a/test/near_miss.ts": `
const transport_timeout = 3000;
const report_interval = 9999;
const exportCount1 = 5555;
const supportedVersion2 = 4841;
const transportTimeout = 30000;
`
    });
    const r = analyze(dir);
    assert.deepEqual([...r.ports.keys()], []);
    assert.deepEqual(r.inline, []);
    fs.rmSync(dir, { recursive: true, force: true });
});
