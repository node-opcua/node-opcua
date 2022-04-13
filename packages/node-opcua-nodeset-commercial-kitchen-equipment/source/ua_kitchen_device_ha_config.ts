// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Byte, UAString } from "node-opcua-basic-types"
import { EnumExceptionDeviationFormat } from "node-opcua-nodeset-ua/source/enum_exception_deviation_format"
import { UAHistoricalDataConfiguration, UAHistoricalDataConfiguration_Base } from "node-opcua-nodeset-ua/source/ua_historical_data_configuration"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:KitchenDeviceHAConfigType ns=5;i=1003           |
 * |isAbstract      |false                                             |
 */
export interface UAKitchenDeviceHAConfig_Base extends UAHistoricalDataConfiguration_Base {
    historyDuration: UAProperty<number, /*z*/DataType.Double>;
    samplingInterval: UAProperty<number, /*z*/DataType.Double>;
}
export interface UAKitchenDeviceHAConfig extends UAHistoricalDataConfiguration, UAKitchenDeviceHAConfig_Base {
}