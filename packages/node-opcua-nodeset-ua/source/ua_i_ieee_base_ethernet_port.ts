import type { UInt16, UInt64 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumDuplex } from "./enum_duplex";
import type { UAAnalogUnit } from "./ua_analog_unit";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeBaseEthernetPortType i=24158                           |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeBaseEthernetPort_Base extends UABaseInterface_Base {
    speed: UAAnalogUnit<UInt64, DataType.UInt64>;
    duplex: UABaseDataVariable<EnumDuplex, DataType.Int32>;
    maxFrameLength: UABaseDataVariable<UInt16, DataType.UInt16>;
}
export interface UAIIeeeBaseEthernetPort extends UABaseInterface, UAIIeeeBaseEthernetPort_Base {}