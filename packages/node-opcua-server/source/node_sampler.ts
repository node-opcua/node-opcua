/**
 * @module node-opcua-server
 */
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { MonitoringMode } from "node-opcua-types";
import { hrtime } from "node-opcua-utils";

const debugLog = make_debugLog("node_sampler");
const doDebug = checkDebugFlag("node_sampler");

import type { MonitoredItem } from "./monitored_item.js";

interface ITimer {
    _samplingId: NodeJS.Timeout | false;
    /**
     * the performance.now() time the next tick is due at. Ticks sit on a fixed grid
     * (start + k * samplingInterval) rather than being re-armed from the moment the
     * previous tick ran, as setInterval does: a tick that runs late is followed by a
     * shorter wait, so the long-run sampling rate stays at the requested one.
     */
    nextTick: number;
    /**
     * a Map, not a plain object: this is walked in full on every sampling tick, and a
     * subscription may hold up to maxMonitoredItemsPerSubscription (100 000 by default)
     * items on the same interval. At that size a plain object goes into dictionary mode
     * and every lookup becomes a hash probe, on top of the per-key Object.hasOwn that
     * `for...in` requires. Map also makes the count intrinsic, so the parallel counter
     * that had to be kept in step is gone.
     */
    monitoredItems: Map<number, MonitoredItem>;
    /** the pass that samples every item of this interval, once a tick has queued it */
    passImmediate?: NodeJS.Immediate;
}
const timers: Record<string, ITimer> = {};
const NS_PER_SEC = 1e9;

interface MonitoredItemPriv {
    _on_sampling_timer(): void;
}
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
export function nextSamplingTick(dueAt: number, now: number, samplingInterval: number): number {
    const next = dueAt + samplingInterval;
    const behind = now - next;
    return behind < 0 ? next : next + (Math.floor(behind / samplingInterval) + 1) * samplingInterval;
}

function scheduleNextTick(_t: ITimer, samplingInterval: number, tick: () => void) {
    const now = performance.now();
    _t.nextTick = nextSamplingTick(_t.nextTick, now, samplingInterval);
    // whole milliseconds keep the timeouts on one Node timer list per interval
    _t._samplingId = setTimeout(tick, Math.max(1, Math.round(_t.nextTick - now)));
}

export function appendToTimer(monitoredItem: MonitoredItem): string {
    const samplingInterval = monitoredItem.samplingInterval;
    const key = samplingInterval.toString();
    assert(samplingInterval > 0);
    let _t = timers[key];
    if (!_t) {
        _t = {
            _samplingId: false,
            nextTick: performance.now(),
            monitoredItems: new Map()
        };

        // one immediate per tick samples every item: Node runs the immediates queued before
        // its check phase back to back anyway, so one per item only added the queueing cost
        // without letting any I/O through in between
        const samplePass = () => {
            _t.passImmediate = undefined;
            const start = doDebug ? hrtime() : undefined;
            let counter = 0;
            for (const monitoredItem of _t.monitoredItems.values()) {
                if (monitoredItem.monitoringMode !== MonitoringMode.Disabled) {
                    (monitoredItem as unknown as MonitoredItemPriv)._on_sampling_timer();
                }
                counter++;
            }
            /* c8 ignore next */
            if (doDebug) {
                const elapsed = hrtime(start);
                debugLog(
                    `Sampler ${samplingInterval}  ms : Benchmark took ${(
                        (elapsed[0] * NS_PER_SEC + elapsed[1]) / 1000 / 1000.0
                    ).toFixed(3)} milliseconds for ${counter} elements`
                );
            }
        };
        const tick = () => {
            scheduleNextTick(_t, samplingInterval, tick);
            // a pass still queued from the previous tick samples the same items: nothing to add
            if (!_t.passImmediate) {
                _t.passImmediate = setImmediate(samplePass);
            }
        };
        scheduleNextTick(_t, samplingInterval, tick);
        timers[key] = _t;
    }
    assert(!_t.monitoredItems.has(monitoredItem.monitoredItemId));
    _t.monitoredItems.set(monitoredItem.monitoredItemId, monitoredItem);
    return key;
}

export function removeFromTimer(monitoredItem: MonitoredItem): void {
    const samplingInterval = monitoredItem.samplingInterval;
    assert(samplingInterval > 0);
    assert(typeof monitoredItem._samplingId === "string");
    const key = monitoredItem._samplingId as string;
    const _t = timers[key];
    if (!_t) {
        // c8 ignore next
        doDebug && debugLog("cannot find common timer for samplingInterval", key);
        return;
    }
    assert(_t);
    assert(_t.monitoredItems.has(monitoredItem.monitoredItemId));
    _t.monitoredItems.delete(monitoredItem.monitoredItemId);
    if (_t.monitoredItems.size === 0) {
        if (_t._samplingId !== false) {
            clearTimeout(_t._samplingId);
        }
        if (_t.passImmediate) {
            clearImmediate(_t.passImmediate);
        }
        delete timers[key];
    }
}
