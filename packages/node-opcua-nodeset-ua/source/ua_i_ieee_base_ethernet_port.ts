// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UInt16 } from "node-opcua-basic-types"
import { EnumDuplex } from "./enum_duplex"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UAAnalogUnit } from "./ua_analog_unit"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeBaseEthernetPortType ns=0;i=24158            |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeBaseEthernetPort_Base extends UABaseInterface_Base {
    speed: UAAnalogUnit<UInt64, /*z*/DataType.UInt64>;
    duplex: UABaseDataVariable<EnumDuplex, /*z*/DataType.Int32>;
    maxFrameLength: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
export interface UAIIeeeBaseEthernetPort extends UABaseInterface, UAIIeeeBaseEthernetPort_Base {
}