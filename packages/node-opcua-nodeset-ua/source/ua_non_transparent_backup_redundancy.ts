import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTRedundantServer } from "./dt_redundant_server";
import type { EnumRedundantServerMode } from "./enum_redundant_server_mode";
import type { UANonTransparentRedundancy, UANonTransparentRedundancy_Base } from "./ua_non_transparent_redundancy";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NonTransparentBackupRedundancyType i=32411                  |
 * |isAbstract      |false                                                       |
 */
export interface UANonTransparentBackupRedundancy_Base extends UANonTransparentRedundancy_Base {
    redundantServerArray: UAProperty<DTRedundantServer[], DataType.ExtensionObject>;
    mode: UAProperty<EnumRedundantServerMode, DataType.Int32>;
    failover: UAMethod;
}
export interface UANonTransparentBackupRedundancy extends Omit<UANonTransparentRedundancy, "redundantServerArray">, UANonTransparentBackupRedundancy_Base {}