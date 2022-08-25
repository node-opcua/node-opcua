// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:IVendorNameplateType ns=1;i=15035               |
 * |isAbstract      |true                                              |
 */
export interface UAIVendorNameplate_Base extends UABaseInterface_Base {
    manufacturer?: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    model?: UAProperty<LocalizedText, DataType.LocalizedText>;
    hardwareRevision?: UAProperty<UAString, DataType.String>;
    softwareRevision?: UAProperty<UAString, DataType.String>;
    deviceRevision?: UAProperty<UAString, DataType.String>;
    productCode?: UAProperty<UAString, DataType.String>;
    deviceManual?: UAProperty<UAString, DataType.String>;
    deviceClass?: UAProperty<UAString, DataType.String>;
    serialNumber?: UAProperty<UAString, DataType.String>;
    productInstanceUri?: UAProperty<UAString, DataType.String>;
    revisionCounter?: UAProperty<Int32, DataType.Int32>;
    softwareReleaseDate?: UAProperty<Date, DataType.DateTime>;
    patchIdentifiers?: UAProperty<UAString[], DataType.String>;
}
export interface UAIVendorNameplate extends UABaseInterface, UAIVendorNameplate_Base {
}