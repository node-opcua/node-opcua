import type { ISessionContext } from "node-opcua-address-space-base";
import type { DataValue } from "node-opcua-data-value";
import type { PreciseClock } from "node-opcua-date-time";

/**
 * reads the value a monitored item samples. `clock` is the time of the sampling tick, read once for all the items
 * the tick samples; a function that needs the time takes it from there rather than reading the clock again.
 */
export type SamplingFunc = (
    context: ISessionContext,
    dataValue: DataValue,
    callback: (err: Error | null, dataValue?: DataValue) => void,
    clock?: PreciseClock
) => void;
