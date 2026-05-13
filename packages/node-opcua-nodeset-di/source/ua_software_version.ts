import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SoftwareVersionType i=212                                   |
 * |isAbstract      |false                                                       |
 */
export interface UASoftwareVersion_Base {
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri: UAProperty<UAString, DataType.String>;
    softwareRevision: UAProperty<UAString, DataType.String>;
    patchIdentifiers?: UAProperty<UAString[], DataType.String>;
    releaseDate?: UAProperty<Date, DataType.DateTime>;
    changeLogReference?: UAProperty<UAString, DataType.String>;
    hash?: UAProperty<Buffer, DataType.ByteString>;
    clear?: UAMethod;
}
export interface UASoftwareVersion extends UAObject, UASoftwareVersion_Base {}