import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAServerRedundancy, UAServerRedundancy_Base } from "./ua_server_redundancy";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NonTransparentRedundancyType i=2039                         |
 * |isAbstract      |false                                                       |
 */
export interface UANonTransparentRedundancy_Base extends UAServerRedundancy_Base {
    serverUriArray: UAProperty<UAString[], DataType.String>;
}
export interface UANonTransparentRedundancy extends UAServerRedundancy, UANonTransparentRedundancy_Base {}