// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/dist/dt_time_zone"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BatchInformationType i=1002                                 |
 * |isAbstract      |false                                                       |
 */
export interface UABatchInformation_Base {
    batchId: UAProperty<UAString, DataType.String>;
    localTime?: UAProperty<DTTimeZone, DataType.ExtensionObject>;
    orderId: UAProperty<UAString, DataType.String>;
    systemTime: UAProperty<Date, DataType.DateTime>;
}
export interface UABatchInformation extends UAObject, UABatchInformation_Base {
}