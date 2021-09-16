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
    manufacturer?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, /*z*/DataType.String>;
    model?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    hardwareRevision?: UAProperty<UAString, /*z*/DataType.String>;
    softwareRevision?: UAProperty<UAString, /*z*/DataType.String>;
    deviceRevision?: UAProperty<UAString, /*z*/DataType.String>;
    productCode?: UAProperty<UAString, /*z*/DataType.String>;
    deviceManual?: UAProperty<UAString, /*z*/DataType.String>;
    deviceClass?: UAProperty<UAString, /*z*/DataType.String>;
    serialNumber?: UAProperty<UAString, /*z*/DataType.String>;
    productInstanceUri?: UAProperty<UAString, /*z*/DataType.String>;
    revisionCounter?: UAProperty<Int32, /*z*/DataType.Int32>;
}
export interface UAIVendorNameplate extends UABaseInterface, UAIVendorNameplate_Base {
}