// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAFile, UAFile_Base } from "./ua_file"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TrustListType i=12522                                       |
 * |isAbstract      |false                                                       |
 */
export interface UATrustList_Base extends UAFile_Base {
    lastUpdateTime: UAProperty<Date, DataType.DateTime>;
    updateFrequency?: UAProperty<number, DataType.Double>;
    activityTimeout?: UAProperty<number, DataType.Double>;
    defaultValidationOptions?: UAProperty<UInt32, DataType.UInt32>;
    openWithMasks: UAMethod;
    closeAndUpdate: UAMethod;
    addCertificate: UAMethod;
    removeCertificate: UAMethod;
}
export interface UATrustList extends UAFile, UATrustList_Base {
}