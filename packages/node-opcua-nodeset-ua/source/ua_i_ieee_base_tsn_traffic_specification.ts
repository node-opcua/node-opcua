import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTUnsignedRationalNumber } from "./dt_unsigned_rational_number";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeBaseTsnTrafficSpecificationType i=24179                |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeBaseTsnTrafficSpecification_Base extends UABaseInterface_Base {
    maxIntervalFrames: UABaseDataVariable<UInt16, DataType.UInt16>;
    maxFrameSize: UABaseDataVariable<UInt32, DataType.UInt32>;
    interval: UABaseDataVariable<DTUnsignedRationalNumber, DataType.ExtensionObject>;
}
export interface UAIIeeeBaseTsnTrafficSpecification extends UABaseInterface, UAIIeeeBaseTsnTrafficSpecification_Base {}