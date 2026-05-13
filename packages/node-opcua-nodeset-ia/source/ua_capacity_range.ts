import type { UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UADataItem, UADataItem_Base } from "node-opcua-nodeset-ua/dist/ua_data_item";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * Represent a scale of calibration values. The
 * value defines the range (lowest and highest
 * value), and the resolution property the size of
 * each step.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |CapacityRangeType i=2003                                    |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTRange i=884                                               |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UACapacityRange_Base<T extends DTRange>  extends UADataItem_Base<T, DataType.ExtensionObject> {
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
    resolution: UAProperty<number, DataType.Double>;
}
export interface UACapacityRange<T extends DTRange> extends UADataItem<T, DataType.ExtensionObject>, UACapacityRange_Base<T> {}