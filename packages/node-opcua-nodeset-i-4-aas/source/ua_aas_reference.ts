import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTAASKey } from "./dt_aas_key.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASReferenceType i=1004                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAASReference_Base {
   // PlaceHolder for $Referable$
    keys: UAProperty<DTAASKey[], DataType.ExtensionObject>;
}
export interface UAAASReference extends UAObject, UAAASReference_Base {}