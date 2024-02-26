// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTRedundantServer } from "./dt_redundant_server"
import { EnumRedundantServerMode } from "./enum_redundant_server_mode"
import { UANonTransparentRedundancy, UANonTransparentRedundancy_Base } from "./ua_non_transparent_redundancy"
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
export interface UANonTransparentBackupRedundancy extends Omit<UANonTransparentRedundancy, "redundantServerArray">, UANonTransparentBackupRedundancy_Base {
}