/**
 * @module node-opca-aggregates
 */

export { AggregateFunction } from "node-opcua-constants";
export {
    addAggregateFunctionSupport,
    addAggregateStandardFunctionSupport,
    addAggregateSupport,
    getAggregateConfiguration,
    installAggregateConfigurationOptions
} from "./aggregates.js";
export * from "./average.js";
export * from "./common.js";
export { getCountData } from "./count.js";
export { getDurationBadData } from "./duration_bad.js";
export { getDurationGoodData } from "./duration_good.js";
export * from "./interpolate.js";
export * from "./interval.js";
export * from "./minmax.js";
export { getPercentBadData } from "./percent_bad.js";
export { getPercentGoodData } from "./percent_good.js";
export * from "./read_processed_details.js";
