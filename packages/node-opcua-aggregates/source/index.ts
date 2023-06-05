/**
 * @module node-opca-aggregates
 */
export {
    addAggregateSupport,
    installAggregateConfigurationOptions,
    getAggregateConfiguration,
    addAggregateStandardFunctionSupport,
    addAggregateFunctionSupport
} from "./aggregates";
export * from "./interpolate";
export * from "./minmax";
export * from "./interval";
export * from "./common";
export * from "./average";
export * from "./read_processed_details";
export { AggregateFunction } from "node-opcua-constants";
export { getCountData } from "./count";
export { getPercentGoodData } from "./percent_good";
export { getPercentBadData } from "./percent_bad";
export { getDurationBadData } from "./duration_bad";
export { getDurationGoodData } from "./duration_good";
