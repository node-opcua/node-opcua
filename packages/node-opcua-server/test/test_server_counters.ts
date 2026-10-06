import { Worker } from "node:worker_threads";
import should from "should";
import { LocalServerCounters, ServerCounter, SharedServerCounters } from "../dist/server_counters.js";

// a thread that waits for the start signal, then races the others for the same counts
const racer = `
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
    const { SharedServerCounters, ServerCounter } = await import(workerData.moduleUrl);
    const counters = new SharedServerCounters(workerData.buffer);
    const gate = new Int32Array(workerData.gate);
    parentPort.postMessage({ ready: true });
    Atomics.wait(gate, 0, 0);
    let taken = 0;
    for (let k = 0; k < workerData.attempts; k++) {
        if (counters.tryAcquire(ServerCounter.Sessions, workerData.limit)) taken++;
        // a slot taken and given back, as subscriptions come and go
        counters.add(ServerCounter.Subscriptions, 1);
        counters.add(ServerCounter.Subscriptions, -1);
    }
    const ids = [];
    for (let k = 0; k < workerData.ids; k++) ids.push(counters.add(ServerCounter.SubscriptionId, 1));
    parentPort.postMessage({ taken, ids });
})();
`;

interface RacerResult {
    taken: number;
    ids: number[];
}

async function race(threads: number, options: { attempts: number; limit: number; ids: number; firstId: number }) {
    const buffer = SharedServerCounters.allocate(options.firstId);
    const gate = new SharedArrayBuffer(4);
    const moduleUrl = new URL("../dist/server_counters.js", import.meta.url).href;
    const workers: Worker[] = [];
    const ready: Promise<void>[] = [];
    const results: Promise<RacerResult>[] = [];
    for (let t = 0; t < threads; t++) {
        const worker = new Worker(racer, { eval: true, workerData: { ...options, buffer, gate, moduleUrl } });
        workers.push(worker);
        let onReady: () => void = () => undefined;
        ready.push(new Promise<void>((resolve) => (onReady = resolve)));
        results.push(
            new Promise<RacerResult>((resolve, reject) => {
                worker.on("message", (message: { ready?: boolean } & RacerResult) => {
                    if (message.ready) onReady();
                    else resolve(message);
                });
                worker.once("error", reject);
            })
        );
    }
    await Promise.all(ready);
    // every thread starts at once
    Atomics.store(new Int32Array(gate), 0, 1);
    Atomics.notify(new Int32Array(gate), 0);
    const outcome = await Promise.all(results);
    await Promise.all(workers.map((worker) => worker.terminate()));
    return { counters: new SharedServerCounters(buffer), outcome };
}

describe("ServerCounters", function () {
    this.timeout(60000);

    it("a plain counter takes a slot only below the limit", () => {
        const counters = new LocalServerCounters();
        should(counters.tryAcquire(ServerCounter.Sessions, 2)).eql(true);
        should(counters.tryAcquire(ServerCounter.Sessions, 2)).eql(true);
        should(counters.tryAcquire(ServerCounter.Sessions, 2)).eql(false);
        should(counters.add(ServerCounter.Sessions, -1)).eql(1);
        should(counters.tryAcquire(ServerCounter.Sessions, 2)).eql(true);
        should(counters.get(ServerCounter.Sessions)).eql(2);
    });

    it("threads racing for the same slots take exactly the limit, no more", async () => {
        const threads = 8;
        const attempts = 20000;
        const limit = 100000; // below the 160,000 attempts: the last slots are fought over
        const { counters, outcome } = await race(threads, { attempts, limit, ids: 0, firstId: 1 });
        const taken = outcome.reduce((sum, r) => sum + r.taken, 0);
        should(taken).eql(limit, "the slots taken, over every thread");
        should(counters.get(ServerCounter.Sessions)).eql(limit);
        should(counters.get(ServerCounter.Subscriptions)).eql(0, "every slot taken was given back");
    });

    it("threads drawing subscription ids at once never draw the same one", async () => {
        const threads = 8;
        const ids = 5000;
        const firstId = 123456;
        const { counters, outcome } = await race(threads, { attempts: 0, limit: 0, ids, firstId });
        const all = outcome.flatMap((r) => r.ids);
        should(new Set(all).size).eql(threads * ids, "no id handed out twice");
        should(Math.min(...all)).eql(firstId + 1);
        should(Math.max(...all)).eql(firstId + threads * ids);
        should(counters.get(ServerCounter.SubscriptionId)).eql(firstId + threads * ids);
    });
});
