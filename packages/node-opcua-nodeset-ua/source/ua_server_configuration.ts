// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "./dt_argument"
import { UACertificateGroupFolder } from "./ua_certificate_group_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ServerConfigurationType ns=0;i=12581              |
 * |isAbstract      |false                                             |
 */
export interface UAServerConfiguration_Base {
    certificateGroups: UACertificateGroupFolder;
    serverCapabilities: UAProperty<UAString[], /*z*/DataType.String>;
    supportedPrivateKeyFormats: UAProperty<UAString[], /*z*/DataType.String>;
    maxTrustListSize: UAProperty<UInt32, /*z*/DataType.UInt32>;
    multicastDnsEnabled: UAProperty<boolean, /*z*/DataType.Boolean>;
    updateCertificate: UAMethod;
    applyChanges: UAMethod;
    createSigningRequest: UAMethod;
    getRejectedList: UAMethod;
}
export interface UAServerConfiguration extends UAObject, UAServerConfiguration_Base {
}