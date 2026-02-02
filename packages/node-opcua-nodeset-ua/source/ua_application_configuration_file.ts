// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAConfigurationFile, UAConfigurationFile_Base } from "./ua_configuration_file"
import { DTUserTokenPolicy } from "./dt_user_token_policy"
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
export interface UAApplicationConfigurationFile extends UAConfigurationFile, UAApplicationConfigurationFile_Base {
}