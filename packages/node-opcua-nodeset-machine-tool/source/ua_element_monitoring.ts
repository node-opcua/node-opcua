import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ElementMonitoringType i=23                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAElementMonitoring_Base {
    name: UAProperty<UAString, DataType.String>;
}
export interface UAElementMonitoring extends UAObject, UAElementMonitoring_Base {}