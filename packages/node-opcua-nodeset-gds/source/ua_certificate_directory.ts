// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UACertificateGroupFolder } from "node-opcua-nodeset-ua/dist/ua_certificate_group_folder"
import { UADirectory, UADirectory_Base } from "./ua_directory"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CertificateDirectoryType i=63                               |
 * |isAbstract      |false                                                       |
 */
export interface UACertificateDirectory_Base extends UADirectory_Base {
    startSigningRequest: UAMethod;
    startNewKeyPairRequest: UAMethod;
    finishRequest: UAMethod;
    revokeCertificate?: UAMethod;
    getCertificateGroups: UAMethod;
    getCertificates?: UAMethod;
    getTrustList: UAMethod;
    getCertificateStatus: UAMethod;
    checkRevocationStatus?: UAMethod;
    certificateGroups: UACertificateGroupFolder;
}
export interface UACertificateDirectory extends UADirectory, UACertificateDirectory_Base {
}