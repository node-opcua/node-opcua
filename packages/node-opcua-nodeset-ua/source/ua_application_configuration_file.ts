import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTUserTokenPolicy } from "./dt_user_token_policy";
import type { UAConfigurationFile, UAConfigurationFile_Base } from "./ua_configuration_file";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ApplicationConfigurationFileType i=15550                    |
 * |isAbstract      |false                                                       |
 */
export interface UAApplicationConfigurationFile_Base extends UAConfigurationFile_Base {
    availableNetworks: UAProperty<UAString[], DataType.String>;
    availablePorts: UAProperty<UAString, DataType.String>;
    maxEndpoints: UAProperty<UInt16, DataType.UInt16>;
    maxCertificateGroups: UAProperty<UInt16, DataType.UInt16>;
    securityPolicyUris: UAProperty<UAString[], DataType.String>;
    userTokenTypes: UAProperty<DTUserTokenPolicy[], DataType.ExtensionObject>;
    certificateTypes: UAProperty<NodeId[], DataType.NodeId>;
    certificateGroupPurposes: UAProperty<NodeId[], DataType.NodeId>;
}
export interface UAApplicationConfigurationFile extends UAConfigurationFile, UAApplicationConfigurationFile_Base {}