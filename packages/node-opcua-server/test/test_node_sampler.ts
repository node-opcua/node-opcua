import type { PreciseClock } from "node-opcua-date-time";
import { MonitoringMode } from "node-opcua-types";
import should from "should";
import sinon from "sinon";
import type { MonitoredItem } from "../source/index.js";
import { appendToTimer, itemsSampledPerClockRead, nextSamplingTick, removeFromTimer } from "../source/node_sampler.js";

describe("node_sampler", () => {
    describe("nextSamplingTick", () => {
        it("keeps the next tick one interval after the previous due time when the tick ran on time", () => {
            should(nextSamplingTick(1000, 1000, 10)).eql(1010);
        });

        it("does not push the grid back when a tick runs late", () => {
            // the tick due at 1000 ran at 1003: the next one is still due at 1010, not at 1013
            should(nextSamplingTick(1000, 1003, 10)).eql(1010);
            should(nextSamplingTick(1000, 1009.9, 10)).eql(1010);
        });

        it("skips the ticks that are already past when the loop fell a whole interval behind", () => {
            should(nextSamplingTick(1000, 1010, 10)).eql(1020);
            should(nextSamplingTick(1000, 1025, 10)).eql(1030);
            should(nextSamplingTick(1000, 1030, 10)).eql(1040);
        });

        it("keeps the long-run rate when every tick runs late by a fraction of the interval", () => {
            // a setInterval re-armed from each late run would lose one tick in eleven here
            let dueAt = 0;
            let ticks = 0;
            while (dueAt < 10_000) {
                const ranAt = dueAt + 1;
                dueAt = nextSamplingTick(dueAt, ranAt, 10);
                ticks++;
            }
            should(ticks).eql(1000);
        });
    });

    describe("appendToTimer", () => {
        let clock: sinon.SinonFakeTimers;
        beforeEach(() => {
            clock = sinon.useFakeTimers();
        });
        afterEach(() => {
            clock.restore();
        });

        function fakeMonitoredItem(monitoredItemId: number, samplingInterval: number) {
            const item = {
                monitoredItemId,
                samplingInterval,
                monitoringMode: MonitoringMode.Reporting as MonitoringMode,
                _samplingId: undefined as string | undefined,
                samples: 0,
                _on_sampling_timer() {
                    item.samples++;
                },
                _record_held_sample(_readAt: PreciseClock, _answeredAt: PreciseClock) {
                    /* records nothing */
                },
                getSessionContext(): object | null {
                    return null;
                }
            };
            return item;
        }

        it("samples every item of the interval in one pass, and skips a disabled one", () => {
            const item1 = fakeMonitoredItem(11, 10);
            const item2 = fakeMonitoredItem(12, 10);
            item2.monitoringMode = MonitoringMode.Disabled;
            item1._samplingId = appendToTimer(item1 as unknown as MonitoredItem);
            item2._samplingId = appendToTimer(item2 as unknown as MonitoredItem);

            clock.tick(105);
            should(item1.samples).eql(10);
            should(item2.samples).eql(0);

            removeFromTimer(item1 as unknown as MonitoredItem);
            removeFromTimer(item2 as unknown as MonitoredItem);
            should(clock.countTimers()).eql(0);
        });

        it("samples the items of one session context inside a single permission cache per tick", () => {
            let cacheCalls = 0;
            let insideCache = false;
            const context = {
                withPermissionCache<T>(action: () => T): T {
                    cacheCalls++;
                    insideCache = true;
                    try {
                        return action();
                    } finally {
                        insideCache = false;
                    }
                }
            };
            const sampledInsideCache: boolean[] = [];
            const makeItem = (id: number) => {
                const item = fakeMonitoredItem(id, 10);
                item._on_sampling_timer = () => {
                    item.samples++;
                    sampledInsideCache.push(insideCache);
                };
                item.getSessionContext = () => context;
                return item;
            };
            const item1 = makeItem(21);
            const item2 = makeItem(22);
            item1._samplingId = appendToTimer(item1 as unknown as MonitoredItem);
            item2._samplingId = appendToTimer(item2 as unknown as MonitoredItem);

            clock.tick(15);
            should(cacheCalls).eql(1);
            should(sampledInsideCache).eql([true, true]);

            removeFromTimer(item1 as unknown as MonitoredItem);
            removeFromTimer(item2 as unknown as MonitoredItem);
        });

        it("reads the clock once per chunk of items, and records a chunk's values with the clock read once it has answered", () => {
            type Event =
                | { kind: "sample"; id: number; readAt?: PreciseClock; hold?: boolean }
                | { kind: "record"; id: number; readAt: PreciseClock; answeredAt: PreciseClock };
            const events: Event[] = [];
            const count = itemsSampledPerClockRead + 2;
            const items = Array.from({ length: count }, (_, id) => {
                const item = fakeMonitoredItem(100 + id, 10);
                item._on_sampling_timer = (readAt?: PreciseClock, hold?: boolean) => {
                    item.samples++;
                    events.push({ kind: "sample", id, readAt, hold });
                };
                item._record_held_sample = (readAt: PreciseClock, answeredAt: PreciseClock) => {
                    events.push({ kind: "record", id, readAt, answeredAt });
                };
                item._samplingId = appendToTimer(item as unknown as MonitoredItem);
                return item;
            });

            clock.tick(15);
            should(events.length).eql(2 * count);
            const firstChunk = events.slice(0, 2 * itemsSampledPerClockRead);
            const secondChunk = events.slice(2 * itemsSampledPerClockRead);
            for (const chunk of [firstChunk, secondChunk]) {
                const size = chunk.length / 2;
                const samples = chunk.slice(0, size);
                const records = chunk.slice(size);
                // every item of the chunk is sampled, holding its value, before any is recorded
                should(samples.every((e) => e.kind === "sample" && e.hold === true)).eql(true);
                should(records.every((e) => e.kind === "record")).eql(true);
                // one clock to sample the chunk with, one read once it has answered to record it with
                const readAt = samples[0].readAt;
                should(readAt).not.be.undefined();
                should(samples.every((e) => e.readAt === readAt)).eql(true);
                const answeredAt = (records[0] as { answeredAt: PreciseClock }).answeredAt;
                should(answeredAt).not.equal(readAt);
                should(records.every((e) => e.kind === "record" && e.readAt === readAt && e.answeredAt === answeredAt)).eql(true);
            }
            // the second chunk is sampled with the clock read once the first had answered
            should(secondChunk[0].readAt).equal(
                (firstChunk[2 * itemsSampledPerClockRead - 1] as { answeredAt: PreciseClock }).answeredAt
            );

            for (const item of items) {
                removeFromTimer(item as unknown as MonitoredItem);
            }
        });

        it("samples every interval until the last item is removed", () => {
            const item = fakeMonitoredItem(1, 10);
            const asMonitoredItem = item as unknown as MonitoredItem;
            item._samplingId = appendToTimer(asMonitoredItem);

            // the samples themselves run in a setImmediate after the tick due at 1000
            clock.tick(1005);
            should(item.samples).eql(100);

            removeFromTimer(asMonitoredItem);
            clock.tick(1000);
            should(item.samples).eql(100);
            should(clock.countTimers()).eql(0);
        });
    });
});
