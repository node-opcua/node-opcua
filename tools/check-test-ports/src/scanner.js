/**
 * check-test-ports - the scanner. Pure: it reads files and returns findings, printing
 * nothing and exiting nothing. src/index.js is the command line around it.
 *
 * The suite binds fixed ports on purpose. A deterministic port makes a failure
 * attributable, where an ephemeral one turns a collision into a ghost. That only holds
 * while no two test files pick the same number - and since the runner executes files
 * concurrently, two files sharing a port is not a style problem, it is an EADDRINUSE
 * waiting for the machine to be busy enough.
 *
 * The convention this enforces:
 *
 *     const port = 5741;          // once, at the top of the file
 *     ...
 *     await startServer({ port }); // everywhere else refers to the constant
 *
 * That rule is what keeps this scanner simple. A port written straight into an options
 * object propagates transitively through calls and modules, and following it would mean
 * resolving variables across files. Instead the convention forbids it, so the
 * declarations are a complete picture and a reader can find a file's port by looking at
 * the top of it.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** roots scanned for workspace packages */
export const PACKAGE_ROOTS = ["packages", "packages_extra"];
/** per-package directories holding tests and their fixtures */
export const TEST_DIRS = ["test", "test_helpers", "test-fixtures"];
const EXTENSIONS = new Set([".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"]);

/** Linux's default ip_local_port_range. A fixed port at or above this can be stolen. */
export const EPHEMERAL_FLOOR = 32768;
/** below 1024 needs privileges; the suite should never pin one */
export const PRIVILEGED_CEILING = 1024;
/**
 * Ports that belong to somebody else, and that the suite must not pin.
 *
 * Two kinds. First, the ones this project itself speaks: 4840 is the IANA-registered
 * OPC UA TCP port and 4843 its HTTPS counterpart, so a developer very likely has a real
 * server on one of them - and a test that binds 4840 fails on their machine and nowhere
 * else. 26543-26599 is the range vendor OPC UA tooling uses for discovery.
 *
 * Second, the ports a developer machine tends to have occupied for unrelated reasons:
 * dev servers, databases, brokers, debuggers. Suggesting one produces a test that passes
 * in CI and fails locally, which is the most expensive kind of failure to diagnose
 * because it looks like "works on my machine" in reverse.
 *
 * A range is [first, last] inclusive.
 */
export const RESERVED = [
    // OPC UA itself
    [4840, 4840],   // OPC UA TCP (IANA)
    [4843, 4843],   // OPC UA HTTPS
    [14840, 14840], // OPC UA, second instance by convention
    [26543, 26599], // vendor OPC UA tooling / discovery
    // TLS-adjacent
    [1443, 1443],
    [2443, 2443],
    [8443, 8443],
    // web and dev servers
    [3000, 3001],   // node, react, grafana
    [4200, 4200],   // angular
    [5000, 5001],   // flask, macOS AirPlay receiver
    [5173, 5174],   // vite
    [7000, 7001],   // macOS AirPlay / control centre
    [8000, 8001],
    [8080, 8081],
    [8888, 8888],   // jupyter
    [9000, 9001],   // php-fpm, sonarqube, minio
    [9090, 9090],   // prometheus
    // databases, brokers, search
    [1883, 1883],   // mqtt
    [3306, 3306],   // mysql
    [5432, 5432],   // postgres
    [5672, 5672],   // amqp
    [6379, 6379],   // redis
    [8883, 8883],   // mqtt over tls
    [9200, 9200],   // elasticsearch
    [15672, 15672], // rabbitmq management
    [27017, 27017], // mongodb
    // tooling
    [9229, 9229],   // node --inspect
    [3128, 3128]    // squid
];

/** is this port somebody else's? */
export function isReserved(port) {
    return RESERVED.some(([lo, hi]) => port >= lo && port <= hi);
}

/** where suggestions start looking */
export const SUGGEST_FLOOR = 5000;

/**
 * Opt-out marker for a deliberate ephemeral port, written on the line or the one above:
 *
 *     // check-test-ports: dynamic-ok - asks the OS for a free port, then closes it
 *     server.listen(0);
 *
 * Not every listen(0) is a mistake. Some are probes rather than binds: finding a free
 * port, obtaining one that is guaranteed closed so a connect is refused instead of
 * hanging, or simply creating an active handle for the leak detector to notice. Pinning
 * a port there changes what the test means. The marker is required to carry a reason, so
 * the next reader can tell a considered exception from a silenced warning.
 */
export const DYNAMIC_OK = "check-test-ports: dynamic-ok";

/**
 * An identifier naming a port: starts with "port" or ends with "Port". Deliberately not
 * a substring match - "transportTimeout" contains "port" and is not one.
 */
const PORT_IDENTIFIER = "(?:port[A-Za-z0-9_]*|[A-Za-z0-9_]*Port)";

/**
 * The declaration form the convention asks for.
 *
 * The optional `: number` matters: TypeScript lets the type sit between the name and the
 * value, and `const port: number = 2345` is the same declaration as `const port = 2345`.
 * Without it the scanner would read the file, find no port, and report the file as
 * binding nothing - the worst kind of miss, because it looks like a clean result.
 */
const DECLARATION = new RegExp(
    `\\b(?:const|let|var)\\s+(${PORT_IDENTIFIER})\\s*(?::\\s*[A-Za-z0-9_.<>[\\]|\\s]+?)?\\s*=\\s*(\\d{1,5})\\b`,
    "gi"
);

/** a port literal written anywhere else - what the convention forbids */
const INLINE = [new RegExp(`\\b${PORT_IDENTIFIER}\\s*:\\s*(\\d{1,5})\\b`, "gi"), /\.listen\(\s*(\d{1,5})\b/g];

/**
 * A port derived from another one: `port + 1`, `basePort + i`, `port++`.
 *
 * These are the worst case, because they are invisible. `const port = 12061` followed by
 * `{ port: port + 1 }` binds 12062 as surely as writing it down, but nothing in the file
 * says 12062 and no scanner short of an evaluator can know it. Two files can then hold
 * what look like distinct ports and still collide - and the report will say they do not.
 *
 * The remedy is always the same shape: name every port that gets bound.
 *
 *     const port1 = 12061;
 *     const port2 = 12062;
 *     const ports = [port1, port2];
 *
 * A counter is excluded: `matchingListenPort++` ends in "Port" but binds nothing. Only a
 * name that also appears as a declared port constant in the same file is reported.
 */
const COMPUTED = [
    // groups: name, operator, operand - the operand is captured so that a literal
    // offset can be resolved to the port actually bound
    new RegExp(`\\b(${PORT_IDENTIFIER})\\s*([+-])\\s*([A-Za-z0-9_]+)`, "g"),
    new RegExp(`\\b(${PORT_IDENTIFIER})\\s*(\\+\\+|--|\\+=|-=)()`, "g")
];

function walk(dir, out) {
    if (!fs.existsSync(dir)) {
        return out;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // node_modules and build output are not ours to police
            if (entry.name === "node_modules" || entry.name === "dist") {
                continue;
            }
            walk(full, out);
        } else if (EXTENSIONS.has(path.extname(entry.name))) {
            out.push(full);
        }
    }
    return out;
}

export function testFiles(root = repoRoot) {
    const files = [];
    for (const packageRoot of PACKAGE_ROOTS) {
        const abs = path.join(root, packageRoot);
        if (!fs.existsSync(abs)) {
            continue;
        }
        for (const name of fs.readdirSync(abs)) {
            for (const sub of TEST_DIRS) {
                walk(path.join(abs, name, sub), files);
            }
        }
    }
    return files.sort();
}

/**
 * @returns {{ports: Map<number, Map<string, number[]>>, dynamic: object[], inline: object[]}}
 */
export function scan(root = repoRoot) {
    const ports = new Map();
    const dynamic = [];
    const inline = [];
    const computed = [];

    const record = (port, rel, line) => {
        if (!ports.has(port)) {
            ports.set(port, new Map());
        }
        const byFile = ports.get(port);
        byFile.set(rel, [...(byFile.get(rel) || []), line]);
    };

    for (const file of testFiles(root)) {
        const rel = path.relative(root, file).split(path.sep).join("/");
        const lines = fs.readFileSync(file, "utf8").split("\n");
        // Names declared as a port constant in this file, so a derived value can be told
        // apart from a counter that merely happens to end in "Port".
        const declaredHere = new Map();
        const computedHere = [];
        lines.forEach((rawText, i) => {
            const line = i + 1;
            let m;
            // A commented-out `//port+=1;` binds nothing. Only whole-line comments are
            // stripped: a trailing `// see 5678` is rare and harmless to keep.
            const trimmed = rawText.trimStart();
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
                return;
            }
            const text = rawText;
            // an ephemeral port this file has declared deliberate
            const dynamicOk = rawText.includes(DYNAMIC_OK) || (i > 0 && lines[i - 1].includes(DYNAMIC_OK));

            DECLARATION.lastIndex = 0;
            while ((m = DECLARATION.exec(text)) !== null) {
                const port = Number(m[2]);
                if (port === 0) {
                    // `let matchingListenPort = 0` is a counter being initialised, not a
                    // port being bound - the name ends in "Port" but nothing listens on
                    // it. Only a const says "this is the port, and it is dynamic"; a
                    // let/var starting at zero is almost always about to be assigned.
                    if (/\bconst\b/.test(m[0])) {
                        dynamic.push({ rel, line, text: text.trim() });
                    }
                } else if (port >= PRIVILEGED_CEILING) {
                    declaredHere.set(m[1], port);
                    record(port, rel, line);
                }
            }

            for (const re of COMPUTED) {
                re.lastIndex = 0;
                while ((m = re.exec(text)) !== null) {
                    computedHere.push({ rel, line, name: m[1], op: m[2], operand: m[3], text: text.trim() });
                }
            }

            for (const re of INLINE) {
                re.lastIndex = 0;
                while ((m = re.exec(text)) !== null) {
                    const port = Number(m[1]);
                    if (port === 0) {
                        if (!dynamicOk) {
                            dynamic.push({ rel, line, text: text.trim() });
                        }
                        continue;
                    }
                    if (port < PRIVILEGED_CEILING) {
                        continue; // almost always a timeout or a buffer size, not a port
                    }
                    // It still binds, so it still collides: count it, and flag it.
                    record(port, rel, line);
                    inline.push({ rel, line, port, text: text.trim() });
                }
            }
        });
        // Resolved after the whole file is read, since a constant may be declared below
        // its use. Where the offset is a literal the bound port is knowable, so record it
        // as occupied - otherwise suggest() could hand out a number something already
        // binds, which is the very failure this tool exists to prevent.
        for (const c of computedHere) {
            if (!declaredHere.has(c.name)) {
                continue; // a counter that merely ends in "Port"
            }
            const base = declaredHere.get(c.name);
            const offset = Number(c.operand);
            if ((c.op === "+" || c.op === "-") && Number.isFinite(offset)) {
                c.resolved = c.op === "+" ? base + offset : base - offset;
                record(c.resolved, rel, c.line);
            }
            computed.push(c);
        }
    }
    return { ports, dynamic, inline, computed };
}

/**
 * The next ports nobody uses and nothing can steal, chosen to keep the suite's footprint
 * compact.
 *
 * A free port is not simply the first one available: handing out 5000 when the suite
 * already clusters around 12055 scatters the occupied set, and the point of printing
 * blocks in the summary is that a person can hold the shape in their head. So candidates
 * adjacent to an existing block come first - extending a block keeps the count of blocks
 * flat - and only when none are available does it fall back to scanning from the floor.
 *
 * Ports at or above EPHEMERAL_FLOOR are never suggested: the OS may hand one to somebody
 * else's listen(0) before the test that owns it binds.
 */
export function suggest(ports, count = 1) {
    const free = (p) => p >= SUGGEST_FLOOR && p < EPHEMERAL_FLOOR && !ports.has(p) && !isReserved(p);
    const out = [];
    const take = (p) => {
        if (free(p) && !out.includes(p)) {
            out.push(p);
        }
    };

    // first choice: grow the blocks that already exist, largest first, so the busiest
    // region of the suite stays contiguous
    for (const block of portBlocks(ports).sort((a, b) => b.count - a.count)) {
        for (let p = block.end + 1; p <= block.end + count && out.length < count; p++) {
            take(p);
        }
        for (let p = block.start - 1; p >= block.start - count && out.length < count; p--) {
            take(p);
        }
        if (out.length >= count) {
            break;
        }
    }

    // fallback: anything free above the floor
    for (let p = SUGGEST_FLOOR; p < EPHEMERAL_FLOOR && out.length < count; p++) {
        take(p);
    }
    return out.slice(0, count).sort((a, b) => a - b);
}

export function analyze(root = repoRoot) {
    const { ports, dynamic, inline, computed } = scan(root);
    return {
        ports,
        dynamic,
        inline,
        computed,
        // Two files sharing a port collide the moment the runner schedules them together.
        collisions: [...ports.entries()].filter(([, byFile]) => byFile.size > 1).sort((a, b) => a[0] - b[0]),
        reserved: [...ports.keys()].filter(isReserved).sort((a, b) => a - b),
        unsafe: [...ports.keys()].filter((p) => p >= EPHEMERAL_FLOOR).sort((a, b) => a - b)
    };
}

/**
 * Only a collision fails. It is unambiguous and one side simply has to move. The other
 * two findings describe bodies of existing tests that need migrating, and failing on
 * them would mean nobody can add a test until that migration is finished.
 */
export function exitCode(result) {
    return result.collisions.length ? 1 : 0;
}

/**
 * Everything the tool is not certain about. A collision is a failure; the rest are
 * doubt - a port it cannot resolve, one sitting where the OS may hand it out, a literal
 * it cannot see from the top of the file, an unmarked ephemeral bind. A gate should
 * refuse all of it, because each is a way for two tests to end up on one port without
 * the report saying so.
 */
export function doubts(result) {
    const { collisions, unsafe, inline, dynamic, computed = [] } = result;
    return {
        collisions: collisions.length,
        ephemeral: unsafe.length,
        reserved: (result.reserved || []).length,
        inlineLiterals: inline.length,
        dynamicPorts: dynamic.length,
        derived: computed.length,
        unresolvable: computed.filter((c) => c.resolved === undefined).length
    };
}

/** the gate: non-zero on a failure or on any doubt */
export function strictExitCode(result) {
    return Object.values(doubts(result)).some((n) => n > 0) ? 1 : 0;
}

/**
 * The ports the suite occupies, collapsed into blocks.
 *
 * Printed so a spurious EADDRINUSE can be checked against the machine rather than the
 * suite: if a local service is sitting on 12061, that is visible here in one line
 * instead of being inferred from a failure. Nearby ports are merged - a gap of a few
 * numbers is noise, and the point is a shape a person can scan, not an exact set.
 */
export function portBlocks(ports, gap = 8) {
    const sorted = [...ports.keys()].sort((a, b) => a - b);
    const blocks = [];
    for (const p of sorted) {
        const last = blocks[blocks.length - 1];
        if (last && p - last.end <= gap) {
            last.end = p;
            last.count++;
        } else {
            blocks.push({ start: p, end: p, count: 1 });
        }
    }
    return blocks;
}

/**
 * A plan for pulling scattered ports into the suite's main cluster.
 *
 * 42 blocks is not a correctness problem - none of them collide - but it makes the
 * occupied set impossible to hold in your head, and that is the thing that lets a local
 * service on some unrelated port go unnoticed. Most of the scatter is singletons: 25
 * blocks of one, another 8 of two or three.
 *
 * The plan moves only those. Ports already sitting in a substantial run are left alone,
 * because moving them is churn across many files for no gain. Destinations are taken
 * first from the gaps inside the anchor block - free numbers the suite already brackets,
 * so using them costs no new territory - and only then by extending past its end.
 */
export function consolidationPlan(result, { maxBlockSize = 3 } = {}) {
    const blocks = portBlocks(result.ports);
    if (!blocks.length) {
        return { anchor: null, moves: [], before: 0, after: 0 };
    }
    const anchor = blocks.reduce((a, b) => (b.count > a.count ? b : a));

    // every port living in a block too small to be worth keeping where it is
    const movable = [];
    for (const b of blocks) {
        if (b === anchor || b.count > maxBlockSize) {
            continue;
        }
        for (const p of [...result.ports.keys()].sort((x, y) => x - y)) {
            if (p >= b.start && p <= b.end) {
                movable.push(p);
            }
        }
    }

    const taken = new Set(result.ports.keys());
    const destinations = [];
    for (let p = anchor.start; p < EPHEMERAL_FLOOR && destinations.length < movable.length; p++) {
        if (!taken.has(p) && !isReserved(p)) {
            destinations.push(p); // gaps inside the anchor first, then past its end
        }
    }

    const moves = movable.map((from, i) => ({
        from,
        to: destinations[i],
        files: [...result.ports.get(from).keys()]
    }));

    const after = new Map(result.ports);
    for (const mv of moves) {
        after.delete(mv.from);
        after.set(mv.to, result.ports.get(mv.from));
    }
    return { anchor, moves, before: blocks.length, after: portBlocks(after).length };
}

/** the consolidation plan, as instructions */
export function formatConsolidation(result, opts) {
    const plan = consolidationPlan(result, opts);
    if (!plan.moves.length) {
        return "check-test-ports: nothing worth consolidating.";
    }
    const out = [
        `Consolidate ${plan.moves.length} scattered port(s) into the ${plan.anchor.start}-${plan.anchor.end} cluster.`,
        "",
        `  ${plan.before} block(s) -> ${plan.after}. Ports already in a run of more than`,
        "  three are left where they are: moving them is churn across many files for no",
        "  gain. Destinations come from gaps the suite already brackets before extending",
        "  past the end of the cluster.",
        "",
        "  Change only the declared constant in each file; every use refers to it.",
        "  A port matching its own filename carries no meaning worth keeping: test_e2e_1170",
        "  binding 1170 reads as a convention but constrains nothing, so it moves like any",
        "  other.",
        ""
    ];
    for (const mv of plan.moves) {
        out.push(`  ${String(mv.from).padStart(5)} -> ${String(mv.to).padStart(5)}   ${mv.files.join(", ")}`);
    }
    out.push("", "  Then run `pnpm run check:ports:summary` - it must still report no collisions.");
    return out.join("\n");
}

/** one line per category, for a CI log */
export function formatSummary(result) {
    const d = doubts(result);
    const rows = [
        ["fixed ports", result.ports.size, null],
        ["collisions", d.collisions, "two files on one port"],
        ["ephemeral-range ports", d.ephemeral, `pinned at or above ${EPHEMERAL_FLOOR}`],
        ["ports belonging to others", d.reserved, "OPC UA's own, or a common dev service"],
        ["literals outside a declaration", d.inlineLiterals, "not visible from the top of the file"],
        ["derived ports", d.derived, "bound but written nowhere"],
        ["  of those, unresolvable", d.unresolvable, "value not statically knowable"],
        ["unmarked port 0", d.dynamicPorts, "the OS chooses"]
    ];
    const out = rows.map(([label, n, why]) => `  ${String(n).padStart(4)}  ${label}${why && n ? ` - ${why}` : ""}`);
    const total = Object.values(d).reduce((a, b) => a + b, 0);
    const blocks = portBlocks(result.ports);
    if (blocks.length) {
        const span = `${blocks[0].start}-${blocks[blocks.length - 1].end}`;
        out.push("", `  ports occupied - ${span}, ${blocks.length} block(s), ${result.ports.size} port(s)`, "");
        // Padded to a fixed column: a block reads as "1975-2030" or "2076", and ragged
        // widths make a long list far harder to scan than the extra spaces cost.
        const cells = blocks.map((b) => (b.start === b.end ? `${b.start}` : `${b.start}-${b.end}`));
        const width = Math.max(...cells.map((c) => c.length));
        const perRow = 6;
        for (let i = 0; i < cells.length; i += perRow) {
            out.push(`      ${cells.slice(i, i + perRow).map((c) => c.padStart(width)).join("   ")}`);
        }
        out.push(
            "",
            "  An EADDRINUSE on one of these may be a local service rather than the suite.",
            "  Check the port named in the failure:",
            "      ss -ltn | grep :<port>                 linux, mac",
            "      netstat -ano | findstr :<port>         windows"
        );
    }
    out.unshift("check-test-ports summary");
    out.push("", total === 0 ? "  OK - nothing unaccounted for." : `  ${total} finding(s); run without --summary for detail.`);
    return out.join("\n");
}

/** the human-readable report */
export function formatReport(result) {
    const { ports, collisions, unsafe, inline, dynamic, computed = [] } = result;
    const out = [];

    if (!collisions.length && !unsafe.length && !inline.length && !dynamic.length && !computed.length) {
        return `check-test-ports: ${ports.size} fixed port(s), no collisions.`;
    }

    if (collisions.length) {
        out.push(`check-test-ports: ${collisions.length} port(s) claimed by more than one file`, "");
        for (const [port, byFile] of collisions) {
            out.push(`  ${port}`);
            for (const [rel, lines] of byFile) {
                out.push(`      ${rel}:${lines.join(",")}`);
            }
        }
        out.push("", `  free port(s) to move one side onto: ${suggest(ports, collisions.length).join(", ")}`);
    }

    if (unsafe.length) {
        out.push("", `check-test-ports: ${unsafe.length} fixed port(s) at or above ${EPHEMERAL_FLOOR}`);
        out.push("  These sit in the ephemeral range and can be taken by any listen(0) first.");
        for (const p of unsafe) {
            out.push(`  ${p}  ${[...ports.get(p).keys()].join(", ")}`);
        }
    }

    if (inline.length) {
        out.push("", `check-test-ports: ${inline.length} port literal(s) outside a declaration`);
        out.push("  Declare the port once at the top of the file and refer to that constant;");
        out.push("  a port buried in an options object cannot be found by reading the file.");
        for (const d of inline) {
            out.push(`  ${d.rel}:${d.line}  ${d.port}`);
        }
    }

    if (computed.length) {
        out.push("", `check-test-ports: ${computed.length} port(s) derived from another`);
        out.push("  `port + 1` binds a port that appears nowhere in the file, so nothing can");
        out.push("  tell whether it collides. Name each one: const port1 = N; const port2 = N+1;");
        out.push("  and where a set is needed, const ports = [port1, port2].");
        for (const d of computed) {
            const value = d.resolved === undefined ? "unresolvable" : `binds ${d.resolved}`;
            out.push(`  ${d.rel}:${d.line}  ${d.text}   -> ${value}`);
        }
    }

    if (dynamic.length) {
        out.push("", `check-test-ports: ${dynamic.length} use(s) of port 0`);
        out.push("  The OS picks these, so a failure names a port nobody can trace back.");
        for (const d of dynamic) {
            out.push(`  ${d.rel}:${d.line}`);
        }
    }

    out.push("", "Run with --suggest <n> for free ports.");
    return out.join("\n");
}

/**
 * A prompt for a coding agent, written so it needs no further discovery: every task
 * names the file, the line, the current value and the exact replacement. Ports are
 * allocated here rather than left to the agent, because two agents - or two passes -
 * choosing "the next free port" independently would reintroduce the collisions this
 * tool exists to catch.
 */
export function formatAiPrompt(result) {
    const { ports, collisions, unsafe, inline, dynamic, computed = [] } = result;

    // Everything that needs a *new* number, deduplicated by file+port.
    const reassign = [];
    const seen = new Set();
    const need = (rel, port, why) => {
        const key = `${rel}#${port}`;
        if (!seen.has(key)) {
            seen.add(key);
            reassign.push({ rel, port, why });
        }
    };
    for (const [port, byFile] of collisions) {
        // the first file keeps the port; every other claimant moves
        for (const rel of [...byFile.keys()].slice(1)) {
            need(rel, port, `collides with ${[...byFile.keys()][0]}`);
        }
    }
    for (const port of unsafe) {
        for (const rel of ports.get(port).keys()) {
            need(rel, port, `inside the ephemeral range (>= ${EPHEMERAL_FLOOR}), stealable by any listen(0)`);
        }
    }

    const pool = suggest(ports, reassign.length + dynamic.length);
    let next = 0;
    const lines = [];

    lines.push(
        "Fix the test-port problems listed below.",
        "",
        "CONVENTION",
        "  Every test file that binds a port declares it once, as a named constant at the",
        "  top of the file, and refers to that constant everywhere else:",
        "",
        "      const port = 5741;",
        "      ...",
        "      await startServer({ port });",
        "",
        "  Rules:",
        "    1. A port number must appear in exactly one file. Two files sharing one",
        "       collide as soon as the runner schedules them together - the suite runs",
        `       test files concurrently, so this is an EADDRINUSE, not a style issue.`,
        `    2. Never use port 0, and never pin a port at or above ${EPHEMERAL_FLOOR}. Port 0 asks`,
        "       the OS to choose, which makes a failure untraceable; a fixed port inside",
        "       the ephemeral range can be handed to somebody else's listen(0) first.",
        "    3. Never write a port literal into an options object or a listen() call.",
        "       Hoist it to the constant. A port that only exists inside a call cannot be",
        "       found by reading the top of the file.",
        "",
        "  Do not change any port other than the ones named below, and do not reuse a",
        "  number that already appears anywhere in the suite.",
        ""
    );

    if (reassign.length) {
        lines.push(`TASK 1 - reassign ${reassign.length} port(s). Use exactly the number given.`, "");
        for (const r of reassign) {
            const to = pool[next++];
            lines.push(`  ${r.rel}`);
            lines.push(`      ${r.port} -> ${to}      (${r.why})`);
            const at = ports.get(r.port).get(r.rel);
            lines.push(`      occurrences at line(s): ${at.join(", ")}`);
        }
        lines.push("");
    }

    if (inline.length) {
        lines.push(
            `TASK 2 - hoist ${inline.length} port literal(s) to a declaration.`,
            "  Add `const port = <value>;` near the top of the file, after the imports, and",
            "  replace the literal with the constant. Where a file needs more than one, name",
            "  them port1, port2, ... following the existing style. Keep the same numbers",
            "  unless TASK 1 also renumbers them, in which case TASK 1 wins.",
            ""
        );
        for (const d of inline) {
            lines.push(`  ${d.rel}:${d.line}   ${d.port}`);
            lines.push(`      ${d.text}`);
        }
        lines.push("");
    }

    if (computed.length) {
        lines.push(
            `TASK 3 - name ${computed.length} derived port(s).`,
            "  A port written as `port + 1` is bound but appears nowhere, so nothing can",
            "  tell whether it collides with another file. Replace each derivation with an",
            "  explicit constant, and where a set is needed collect them in an array:",
            "",
            "      const port1 = 12061;",
            "      const port2 = 12062;",
            "      const ports = [port1, port2];",
            "",
            "  Keep the numbers the derivation produced, so behaviour does not change. If a",
            "  resulting number is already taken, `pnpm run check:ports` will say so.",
            ""
        );
        for (const d of computed) {
            const value = d.resolved === undefined ? "value not statically knowable" : `binds ${d.resolved}`;
            lines.push(`  ${d.rel}:${d.line}   ${d.text}`);
            lines.push(`      ${value}`);
        }
        lines.push("");
    }

    if (dynamic.length) {
        lines.push(
            `TASK 4 - replace ${dynamic.length} use(s) of port 0 with a fixed port.`,
            "  Only where a real server is being started and the test then connects to it.",
            "  Leave listen(0) alone where it is a probe - finding a free port, obtaining a",
            "  deliberately-closed one, or creating an active handle - and say which those",
            "  were. Substituting a fixed port there changes what the test means.",
            "  Declare it as a constant like any other. Use exactly the number given.",
            ""
        );
        for (const d of dynamic) {
            lines.push(`  ${d.rel}:${d.line}   0 -> ${pool[next++]}`);
            lines.push(`      ${d.text}`);
        }
        lines.push("");
    }

    lines.push(
        "VERIFY",
        "  Run `pnpm run check:ports` - it must report no collisions. Then run the tests",
        "  for each package you touched. If a port you introduce turns out to be taken,",
        "  run `pnpm run check:ports:suggest 10` and use one of those instead."
    );
    return lines.join("\n");
}
