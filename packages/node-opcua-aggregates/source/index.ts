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
} from "./aggregates";
export * from "./average";
export * from "./common";
export { getCountData } from "./count";
export { getDurationBadData } from "./duration_bad";
export { getDurationGoodData } from "./duration_good";
export * from "./interpolate";
export * from "./interval";
export * from "./minmax";
export { getPercentBadData } from "./percent_bad";
export { getPercentGoodData } from "./percent_good";
export * from "./read_processed_details";
