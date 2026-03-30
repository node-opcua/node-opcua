import type { ClientMonitoredItem, DataValue } from "node-opcua";

/**
 * Wait for the "changed" event to be emitted on a ClientMonitoredItem.
 *
 * Resolves with the received DataValue as soon as the event fires.
 * Rejects if the event is not received within `timeoutMs` milliseconds.
 */
export function waitForChange(monitoredItem: ClientMonitoredItem, timeoutMs: number = 5000): Promise<DataValue> {
    return new Promise<DataValue>((resolve, reject) => {
        const timer = setTimeout(() => {
            monitoredItem.removeListener("changed", onChanged);
            reject(new Error(`Timeout: no "changed" event received within ${timeoutMs} ms`));
        }, timeoutMs);

        function onChanged(dataValue: DataValue) {
            clearTimeout(timer);
            resolve(dataValue);
        }

        monitoredItem.once("changed", onChanged);
    });
}
