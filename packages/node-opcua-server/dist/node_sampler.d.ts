import type { MonitoredItem } from "./monitored_item.js";
/**
 * how many items are sampled between two clock reads. Each chunk is sampled, then the clock is read once and
 * becomes the server timestamp of the values the chunk obtained: never earlier than a source timestamp taken while
 * they were obtained, and later than when they were obtained by at most the time sampling one chunk takes.
 */
export declare const itemsSampledPerClockRead = 128;
/**
 * the point of the sampling grid the next tick is due at, given the one the current
 * tick was due at.
 *
 * setInterval re-arms from the time the callback actually ran, so every millisecond
 * of lateness (libuv rounds its loop clock to the millisecond, and a busy loop wakes
 * up late) is lost for good: at a 10 ms interval an idle Node process delivers about
 * 98.4 ticks per second instead of 100, and a loaded one fewer. Keeping the ticks on
 * a fixed grid lets a late tick be followed by a shorter wait. When the loop is more
 * than a whole interval behind, the missed ticks are skipped instead of being fired
 * back to back.
 * @private
 */
export declare function nextSamplingTick(dueAt: number, now: number, samplingInterval: number): number;
export declare function appendToTimer(monitoredItem: MonitoredItem): string;
export declare function removeFromTimer(monitoredItem: MonitoredItem): void;
//# sourceMappingURL=node_sampler.d.ts.map