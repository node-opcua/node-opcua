/**
 * @module node-opcua-server
 */
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { hrtime } from "node-opcua-utils";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

import { MonitoredItem } from "./monitored_item";

const timers: any = {};
const NS_PER_SEC = 1e9;

function sampleMonitoredItem(monitoredItem: MonitoredItem) {
    const _monitoredItem = monitoredItem;
    setImmediate(() => {
        (_monitoredItem as any)._on_sampling_timer();
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
            monitoredItems: {},
            monitoredItemsCount: 0
        };

        _t._samplingId = setInterval(() => {
            const start = doDebug ? hrtime() : undefined;
            let counter = 0;
            for (const m in _t.monitoredItems) {
                if (Object.prototype.hasOwnProperty.call(_t.monitoredItems, m)) {
                    sampleMonitoredItem(_t.monitoredItems[m]);
                    counter++;
                }
            }
            if (doDebug) {
                const elapsed = hrtime(start);
                debugLog(
                    `Sampler ${samplingInterval}  ms : Benchmark took ${(
                        (elapsed[0] * NS_PER_SEC + elapsed[1]) /
                        1000 /
                        1000.0
                    ).toFixed(3)} milliseconds for ${counter} elements`
                );
            }
        }, samplingInterval);
        timers[key] = _t;
    }
    assert(!_t.monitoredItems[monitoredItem.monitoredItemId]);
    _t.monitoredItems[monitoredItem.monitoredItemId] = monitoredItem;
    _t.monitoredItemsCount++;
    return key;
}

export function removeFromTimer(monitoredItem: MonitoredItem): void {
    const samplingInterval = monitoredItem.samplingInterval;
    assert(samplingInterval > 0);
    assert(typeof monitoredItem._samplingId === "string");
    const key = monitoredItem._samplingId as string;
    const _t = timers[key];
    if (!_t) {
        debugLog("cannot find common timer for samplingInterval", key);
        return;
    }
    assert(_t);
    assert(_t.monitoredItems[monitoredItem.monitoredItemId]);
    delete _t.monitoredItems[monitoredItem.monitoredItemId];
    _t.monitoredItemsCount--;
    assert(_t.monitoredItemsCount >= 0);
    if (_t.monitoredItemsCount === 0) {
        clearInterval(_t._samplingId);
        delete timers[key];
    }
}
