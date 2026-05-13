import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IVlanIdType i=25218                                         |
 * |isAbstract      |true                                                        |
 */
export interface UAIVlanId_Base extends UABaseInterface_Base {
    vlanId: UABaseDataVariable<UInt16, DataType.UInt16>;
}
export interface UAIVlanId extends UABaseInterface, UAIVlanId_Base {}