// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UADataItem, UADataItem_Base } from "node-opcua-nodeset-ua/source/ua_data_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
/**
 * Represent a scale of calibration values. The
 * value defines the range (lowest and highest
 * value), and the resolution property the size of
 * each step.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |9:CapacityRangeType ns=9;i=2003                   |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTRange ns=0;i=884                                |
 * |isAbstract      |false                                             |
 */
export interface UACapacityRange_Base<T extends DTRange/*j*/>  extends UADataItem_Base<T, /*e*/DataType.ExtensionObject> {
    engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    resolution: UAProperty<number, /*z*/DataType.Double>;
}
export interface UACapacityRange<T extends DTRange/*j*/> extends UADataItem<T, /*n*/DataType.ExtensionObject>, UACapacityRange_Base<T /*B*/> {
}