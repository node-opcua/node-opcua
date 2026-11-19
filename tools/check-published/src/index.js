#!/usr/bin/env node
/**
 * check-published - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-published.mjs                                         # exit 0 all on the registry, 1 missing, 2 no answer
 *     node tools/check-published.mjs --include-private node-opcua-versions
 *     node tools/check-published.mjs --registry https://registry.npmjs.org
 *
 * The publish workflow runs it after a failed `lerna publish` attempt: when every version is
 * already on the registry, the release is complete and the step passes.
 */

import process from "node:process";
import { analyze, DEFAULT_REGISTRY, expectedVersions, exitCode, formatReport, registryHas } from "./rule.js";

function valuesOf(argv, flag) {
    const out = [];
    argv.forEach((a, i) => {
        if (a === flag && argv[i + 1]) {
            out.push(argv[i + 1]);
        }
    });
    return out;
}

async function main() {
    const argv = process.argv.slice(2);
    const registry = valuesOf(argv, "--registry")[0] ?? DEFAULT_REGISTRY;
    const expected = expectedVersions(valuesOf(argv, "--root")[0] ?? ".", valuesOf(argv, "--include-private"));
    const result = await analyze(expected, (name, version) => registryHas(name, version, registry));
    console.log(formatReport(result));
    return exitCode(result);
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(`check-published: ${err?.message ?? err}`);
        process.exit(2);
    }
);
