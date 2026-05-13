import type { UAProperty } from "node-opcua-address-space-base";
import type { UAHistoricalDataConfiguration, UAHistoricalDataConfiguration_Base } from "node-opcua-nodeset-ua/dist/ua_historical_data_configuration";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |KitchenDeviceHAConfigType i=1003                            |
 * |isAbstract      |false                                                       |
 */
export interface UAKitchenDeviceHAConfig_Base extends UAHistoricalDataConfiguration_Base {
    historyDuration: UAProperty<number, DataType.Double>;
    samplingInterval: UAProperty<number, DataType.Double>;
}
export interface UAKitchenDeviceHAConfig extends UAHistoricalDataConfiguration, UAKitchenDeviceHAConfig_Base {}