/**
 * @module node-opcua-server
 */
import { assert } from "node-opcua-assert";
import { getCurrentClock } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { MonitoringMode } from "node-opcua-types";
import { hrtime } from "node-opcua-utils";
const debugLog = make_debugLog("node_sampler");
const doDebug = checkDebugFlag("node_sampler");
const timers = {};
const NS_PER_SEC = 1e9;
/**
 * how many items are sampled between two clock reads. Each chunk is sampled, then the clock is read once and
 * becomes the server timestamp of the values the chunk obtained: never earlier than a source timestamp taken while
 * they were obtained, and later than when they were obtained by at most the time sampling one chunk takes.
 */
export const itemsSampledPerClockRead = 128;
// getCurrentClock() hands out an object it updates in place on its next call: a clock that is kept is a copy
function readClock() {
    const now = getCurrentClock();
    return { timestamp: now.timestamp, picoseconds: now.picoseconds };
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
export function nextSamplingTick(dueAt, now, samplingInterval) {
    const next = dueAt + samplingInterval;
    const behind = now - next;
    return behind < 0 ? next : next + (Math.floor(behind / samplingInterval) + 1) * samplingInterval;
}
function scheduleNextTick(_t, samplingInterval, tick) {
    const now = performance.now();
    _t.nextTick = nextSamplingTick(_t.nextTick, now, samplingInterval);
    // whole milliseconds keep the timeouts on one Node timer list per interval
    _t._samplingId = setTimeout(tick, Math.max(1, Math.round(_t.nextTick - now)));
}
export function appendToTimer(monitoredItem) {
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
            // the items are sampled per session context, inside that context's permission cache:
            // the Roles and namespace defaults are then resolved once per tick, not once per item
            const groups = new Map();
            for (const monitoredItem of _t.monitoredItems.values()) {
                if (monitoredItem.monitoringMode === MonitoringMode.Disabled) {
                    continue;
                }
                const item = monitoredItem;
                const context = item.getSessionContext();
                const group = groups.get(context);
                if (group) {
                    group.push(item);
                }
                else {
                    groups.set(context, [item]);
                }
                counter++;
            }
            // one clock read per chunk of items rather than per item: a chunk is sampled with the clock read after
            // the previous one, then the clock read once it has answered stamps the values it obtained
            let readAt = readClock();
            for (const [context, items] of groups) {
                const sampleGroup = () => {
                    for (let first = 0; first < items.length; first += itemsSampledPerClockRead) {
                        const end = Math.min(first + itemsSampledPerClockRead, items.length);
                        for (let i = first; i < end; i++) {
                            items[i]._on_sampling_timer(readAt, true);
                        }
                        const answeredAt = readClock();
                        for (let i = first; i < end; i++) {
                            items[i]._record_held_sample(readAt, answeredAt);
                        }
                        readAt = answeredAt;
                    }
                };
                if (context?.withPermissionCache) {
                    context.withPermissionCache(sampleGroup);
                }
                else {
                    sampleGroup();
                }
            }
            /* c8 ignore next */
            if (doDebug) {
                const elapsed = hrtime(start);
                debugLog(`Sampler ${samplingInterval}  ms : Benchmark took ${((elapsed[0] * NS_PER_SEC + elapsed[1]) / 1000 / 1000.0).toFixed(3)} milliseconds for ${counter} elements`);
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
export function removeFromTimer(monitoredItem) {
    const samplingInterval = monitoredItem.samplingInterval;
    assert(samplingInterval > 0);
    assert(typeof monitoredItem._samplingId === "string");
    const key = monitoredItem._samplingId;
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
//# sourceMappingURL=node_sampler.js.map