import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { DataType } from "node-opcua-variant";

import type { DTAggregatedHealth } from "./dt_aggregated_health.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AggregatedHealthType i=2001                                 |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTAggregatedHealth i=3003                                   |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAggregatedHealth_Base<T extends DTAggregatedHealth>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    aggregatedDeviceHealth: UABaseDataVariable<UInt16, DataType.UInt16>;
    aggregatedOperationalHealth: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UAAggregatedHealth<T extends DTAggregatedHealth> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAAggregatedHealth_Base<T> {}