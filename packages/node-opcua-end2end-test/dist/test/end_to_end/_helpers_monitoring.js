/**
 * Wait for the "changed" event to be emitted on a ClientMonitoredItem.
 *
 * Resolves with the received DataValue as soon as the event fires.
 * Rejects if the event is not received within `timeoutMs` milliseconds.
 */
export function waitForChange(monitoredItem, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            monitoredItem.removeListener("changed", onChanged);
            reject(new Error(`Timeout: no "changed" event received within ${timeoutMs} ms`));
        }, timeoutMs);
        function onChanged(dataValue) {
            clearTimeout(timer);
            resolve(dataValue);
        }
        monitoredItem.once("changed", onChanged);
    });
}
//# sourceMappingURL=_helpers_monitoring.js.map