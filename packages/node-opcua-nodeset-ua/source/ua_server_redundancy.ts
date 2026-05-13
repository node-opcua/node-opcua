import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTRedundantServer } from "./dt_redundant_server";
import type { EnumRedundancySupport } from "./enum_redundancy_support";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ServerRedundancyType i=2034                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAServerRedundancy_Base {
    redundancySupport: UAProperty<EnumRedundancySupport, DataType.Int32>;
    redundantServerArray?: UAProperty<DTRedundantServer[], DataType.ExtensionObject>;
}
export interface UAServerRedundancy extends UAObject, UAServerRedundancy_Base {}