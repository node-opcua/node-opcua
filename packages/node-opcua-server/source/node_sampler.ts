/**
 * @module node-opcua-server
 */
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { MonitoringMode } from "node-opcua-types";
import { hrtime } from "node-opcua-utils";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

import type { MonitoredItem } from "./monitored_item";

interface ITimer {
    _samplingId: NodeJS.Timeout | false;
    /**
     * a Map, not a plain object: this is walked in full on every sampling tick, and a
     * subscription may hold up to maxMonitoredItemsPerSubscription (100 000 by default)
     * items on the same interval. At that size a plain object goes into dictionary mode
     * and every lookup becomes a hash probe, on top of the per-key Object.hasOwn that
     * `for...in` requires. Map also makes the count intrinsic, so the parallel counter
     * that had to be kept in step is gone.
     */
    monitoredItems: Map<number, MonitoredItem>;
}
const timers: Record<string, ITimer> = {};
const NS_PER_SEC = 1e9;

interface MonitoredItemPriv {
    _on_sampling_timer(): void;
}
function sampleMonitoredItem(monitoredItem: MonitoredItem) {
    const _monitoredItem = monitoredItem as unknown as MonitoredItemPriv;

    if (monitoredItem.monitoringMode === MonitoringMode.Disabled) {
        return;
    }

    setImmediate(() => {
        _monitoredItem._on_sampling_timer();
    });
}

export function appendToTimer(monitoredItem: MonitoredItem): string {
    const samplingInterval = monitoredItem.samplingInterval;
    const key = samplingInterval.toString();
    assert(samplingInterval > 0);
    let _t = timers[key];
    if (!_t) {
        _t = {
            _samplingId: false,
            monitoredItems: new Map()
        };

        _t._samplingId = setInterval(() => {
            const start = doDebug ? hrtime() : undefined;
            let counter = 0;
            for (const monitoredItem of _t.monitoredItems.values()) {
                sampleMonitoredItem(monitoredItem);
                counter++;
            }
            // c8 ignore next
            if (doDebug) {
                const elapsed = hrtime(start);
                debugLog(
                    `Sampler ${samplingInterval}  ms : Benchmark took ${(
                        (elapsed[0] * NS_PER_SEC + elapsed[1]) / 1000 / 1000.0
                    ).toFixed(3)} milliseconds for ${counter} elements`
                );
            }
        }, samplingInterval);
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
            clearInterval(_t._samplingId);
        }
        delete timers[key];
    }
}
