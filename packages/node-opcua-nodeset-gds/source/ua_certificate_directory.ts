// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt64, UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UACertificateGroupFolder } from "node-opcua-nodeset-ua/source/ua_certificate_group_folder"
import { UADirectory, UADirectory_Base } from "./ua_directory"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |6:CertificateDirectoryType ns=6;i=63              |
 * |isAbstract      |false                                             |
 */
export interface UACertificateDirectory_Base extends UADirectory_Base {
    startSigningRequest: UAMethod;
    startNewKeyPairRequest: UAMethod;
    finishRequest: UAMethod;
    revokeCertificate?: UAMethod;
    getCertificateGroups: UAMethod;
    getTrustList: UAMethod;
    getCertificateStatus: UAMethod;
    certificateGroups: UACertificateGroupFolder;
}
export interface UACertificateDirectory extends UADirectory, UACertificateDirectory_Base {
}