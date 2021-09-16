// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:BatchInformationType ns=5;i=1002                |
 * |isAbstract      |false                                             |
 */
export interface UABatchInformation_Base {
    batchId: UAProperty<UAString, /*z*/DataType.String>;
    localTime?: UAProperty<DTTimeZone, /*z*/DataType.ExtensionObject>;
    orderId: UAProperty<UAString, /*z*/DataType.String>;
    systemTime: UAProperty<Date, /*z*/DataType.DateTime>;
}
export interface UABatchInformation extends UAObject, UABatchInformation_Base {
}