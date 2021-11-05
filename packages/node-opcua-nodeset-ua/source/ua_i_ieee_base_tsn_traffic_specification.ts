// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { DTUnsignedRationalNumber } from "./dt_unsigned_rational_number"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeBaseTsnTrafficSpecificationType ns=0;i=24179 |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeBaseTsnTrafficSpecification_Base extends UABaseInterface_Base {
    maxIntervalFrames: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    maxFrameSize: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    interval: UABaseDataVariable<DTUnsignedRationalNumber, /*z*/DataType.ExtensionObject>;
}
export interface UAIIeeeBaseTsnTrafficSpecification extends UABaseInterface, UAIIeeeBaseTsnTrafficSpecification_Base {
}