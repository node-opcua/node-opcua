import { MonitoringMode } from "node-opcua-types";
import should from "should";
import sinon from "sinon";
import type { MonitoredItem } from "../source/index.js";
import { appendToTimer, nextSamplingTick, removeFromTimer } from "../source/node_sampler.js";

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
                monitoringMode: MonitoringMode.Reporting,
                _samplingId: undefined as string | undefined,
                samples: 0,
                _on_sampling_timer() {
                    item.samples++;
                }
            };
            return item;
        }

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
