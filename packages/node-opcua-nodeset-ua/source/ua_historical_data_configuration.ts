// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { Byte, UAString } from "node-opcua-basic-types"
import { UAAggregateConfiguration } from "./ua_aggregate_configuration"
import { UAFolder } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |HistoricalDataConfigurationType ns=0;i=2318       |
 * |isAbstract      |false                                             |
 */
export interface UAHistoricalDataConfiguration_Base {
    aggregateConfiguration: UAAggregateConfiguration;
    aggregateFunctions?: UAFolder;
    stepped: UAProperty<boolean, /*z*/DataType.Boolean>;
    definition?: UAProperty<UAString, /*z*/DataType.String>;
    maxTimeInterval?: UAProperty<number, /*z*/DataType.Double>;
    minTimeInterval?: UAProperty<number, /*z*/DataType.Double>;
    exceptionDeviation?: UAProperty<number, /*z*/DataType.Double>;
    exceptionDeviationFormat?: UAProperty<any, any>;
    startOfArchive?: UAProperty<Date, /*z*/DataType.DateTime>;
    startOfOnlineArchive?: UAProperty<Date, /*z*/DataType.DateTime>;
    serverTimestampSupported?: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAHistoricalDataConfiguration extends UAObject, UAHistoricalDataConfiguration_Base {
}