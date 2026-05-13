import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTRedundantServer } from "./dt_redundant_server";
import type { UAServerRedundancy, UAServerRedundancy_Base } from "./ua_server_redundancy";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TransparentRedundancyType i=2036                            |
 * |isAbstract      |false                                                       |
 */
export interface UATransparentRedundancy_Base extends UAServerRedundancy_Base {
    redundantServerArray: UAProperty<DTRedundantServer[], DataType.ExtensionObject>;
    currentServerId: UAProperty<UAString, DataType.String>;
}
export interface UATransparentRedundancy extends Omit<UAServerRedundancy, "redundantServerArray">, UATransparentRedundancy_Base {}