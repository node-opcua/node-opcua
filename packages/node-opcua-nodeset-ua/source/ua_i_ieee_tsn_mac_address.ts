import type { Byte } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeTsnMacAddressType i=24199                              |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeTsnMacAddress_Base extends UABaseInterface_Base {
    destinationAddress: UABaseDataVariable<Byte[], DataType.Byte>;
    sourceAddress?: UABaseDataVariable<Byte[], DataType.Byte>;
}
export interface UAIIeeeTsnMacAddress extends UABaseInterface, UAIIeeeTsnMacAddress_Base {}