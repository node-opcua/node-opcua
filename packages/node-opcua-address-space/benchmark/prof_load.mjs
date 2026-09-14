/**
 * Where a load actually spends its time, with the process start-up excluded.
 *
 *     node benchmark/prof_load.mjs [repeats]
 *
 * The profiler is driven through the inspector session rather than `--cpu-prof`, and only
 * around the measured loads: a whole-process profile of a load is three quarters module
 * resolution, which is real time but not time anyone can do anything about. Two loads are run
 * first and thrown away so the samples describe warm code.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Session } from "node:inspector/promises";

// pin the priority: on a laptop with performance and efficiency cores the scheduler will move a
// benchmark onto an E-core partway through and the wall clock then reports a regression that is
// not there. Several wrong conclusions have come from not doing this.
try {
    os.setPriority(0, os.constants.priority.PRIORITY_HIGH);
} catch {
    console.error("(could not raise process priority; timings will be noisier)");
}
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

const files = [nodesets.standard, nodesets.di, nodesets.machinery, nodesets.ia];
const repeats = Number(process.argv[2] || 6);

async function load() {
    const addressSpace = AddressSpace.create();
    const t0 = process.hrtime.bigint();
    await generateAddressSpace(addressSpace, files);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    addressSpace.dispose();
    return ms;
}

// warm: compile the code and fill the inline caches before anything is recorded
await load();
await load();

const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 200 });
await session.post("Profiler.start");

const times = [];
for (let i = 0; i < repeats; i++) times.push(await load());

const { profile } = await session.post("Profiler.stop");
session.disconnect();

const dir = path.join(import.meta.dirname, ".prof");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, "warm.cpuprofile");
fs.writeFileSync(out, JSON.stringify(profile));

times.sort((a, b) => a - b);
console.log(`${repeats} loads: min ${times[0].toFixed(1)} ms, median ${times[repeats >> 1].toFixed(1)} ms`);
console.log(`profile -> ${out}`);
