// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UADevice, UADevice_Base } from "node-opcua-nodeset-di/dist/ua_device"
/**
 * Components mounted in a controller cabinet or a
 * motion device e.g. an IO-board or a power supply.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuxiliaryComponentType i=17725                              |
 * |isAbstract      |false                                                       |
 */
export interface UAAuxiliaryComponent_Base extends UADevice_Base {
    /**
     * productCode
     * The ProductCode property provides a unique
     * combination of numbers and letters used to
     * identify the product. It may be the order
     * information displayed on type shields or in ERP
     * systems.
     */
    productCode: UAProperty<UAString, DataType.String>;
}
export interface UAAuxiliaryComponent extends Omit<UADevice, "productCode">, UAAuxiliaryComponent_Base {
}