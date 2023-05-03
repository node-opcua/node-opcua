// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UAString } from "node-opcua-basic-types"
import { EnumApplication } from "./enum_application"
import { DTArgument } from "./dt_argument"
import { DTTransactionError } from "./dt_transaction_error"
import { UACertificateGroupFolder } from "./ua_certificate_group_folder"
import { UATransactionDiagnostics } from "./ua_transaction_diagnostics"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ServerConfigurationType i=12581                             |
 * |isAbstract      |false                                                       |
 */
export interface UAServerConfiguration_Base {
    certificateGroups: UACertificateGroupFolder;
    applicationUri?: UAProperty<UAString, DataType.String>;
    productUri?: UAProperty<UAString, DataType.String>;
    applicationType?: UAProperty<EnumApplication, DataType.Int32>;
    serverCapabilities: UAProperty<UAString[], DataType.String>;
    supportedPrivateKeyFormats: UAProperty<UAString[], DataType.String>;
    maxTrustListSize: UAProperty<UInt32, DataType.UInt32>;
    multicastDnsEnabled: UAProperty<boolean, DataType.Boolean>;
    hasSecureElement?: UAProperty<boolean, DataType.Boolean>;
    updateCertificate: UAMethod;
    getCertificates?: UAMethod;
    applyChanges: UAMethod;
    cancelChanges?: UAMethod;
    createSigningRequest: UAMethod;
    getRejectedList: UAMethod;
    resetToServerDefaults?: UAMethod;
    transactionDiagnostics?: UATransactionDiagnostics;
}
export interface UAServerConfiguration extends UAObject, UAServerConfiguration_Base {
}