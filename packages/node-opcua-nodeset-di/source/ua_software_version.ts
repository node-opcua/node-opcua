// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:SoftwareVersionType ns=1;i=212                  |
 * |isAbstract      |false                                             |
 */
export interface UASoftwareVersion_Base {
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri: UAProperty<UAString, DataType.String>;
    softwareRevision: UAProperty<UAString, DataType.String>;
    patchIdentifiers?: UAProperty<UAString[], DataType.String>;
    releaseDate?: UAProperty<Date, DataType.DateTime>;
    changeLogReference?: UAProperty<UAString, DataType.String>;
    hash?: UAProperty<Buffer, DataType.ByteString>;
}
export interface UASoftwareVersion extends UAObject, UASoftwareVersion_Base {
}