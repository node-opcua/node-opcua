import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumAASIdentifierType } from "./enum_aas_identifier_type";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASIdentifierType i=1029                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAAASIdentifier_Base {
    id: UAProperty<UAString, DataType.String>;
    idType: UAProperty<EnumAASIdentifierType, DataType.Int32>;
}
export interface UAAASIdentifier extends UAObject, UAAASIdentifier_Base {}