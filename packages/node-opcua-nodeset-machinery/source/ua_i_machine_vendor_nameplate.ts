// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAIMachineryItemVendorNameplate, UAIMachineryItemVendorNameplate_Base } from "./ua_i_machinery_item_vendor_nameplate"
/**
 * Interface containing identification and nameplate
 * information for a machine provided by the machine
 * vendor
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:IMachineVendorNameplateType ns=8;i=1010         |
 * |isAbstract      |true                                              |
 */
export interface UAIMachineVendorNameplate_Base extends UAIMachineryItemVendorNameplate_Base {
    /**
     * productInstanceUri
     * A globally unique resource identifier provided by
     * the manufacturer of the machine
     */
    productInstanceUri: UAProperty<UAString, DataType.String>;
}
export interface UAIMachineVendorNameplate extends Omit<UAIMachineryItemVendorNameplate, "productInstanceUri">, UAIMachineVendorNameplate_Base {
}