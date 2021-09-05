// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFile, UAFile_Base } from "./ua_file"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |TrustListType ns=0;i=12522                        |
 * |isAbstract      |false                                             |
 */
export interface UATrustList_Base extends UAFile_Base {
    lastUpdateTime: UAProperty<Date, /*z*/DataType.DateTime>;
    updateFrequency?: UAProperty<number, /*z*/DataType.Double>;
    openWithMasks: UAMethod;
    closeAndUpdate?: UAMethod;
    addCertificate?: UAMethod;
    removeCertificate?: UAMethod;
}
export interface UATrustList extends UAFile, UATrustList_Base {
}