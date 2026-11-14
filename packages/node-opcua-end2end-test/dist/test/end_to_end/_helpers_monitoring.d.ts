import type { ClientMonitoredItem, DataValue } from "node-opcua";
/**
 * Wait for the "changed" event to be emitted on a ClientMonitoredItem.
 *
 * Resolves with the received DataValue as soon as the event fires.
 * Rejects if the event is not received within `timeoutMs` milliseconds.
 */
export declare function waitForChange(monitoredItem: ClientMonitoredItem, timeoutMs?: number): Promise<DataValue>;
//# sourceMappingURL=_helpers_monitoring.d.ts.map