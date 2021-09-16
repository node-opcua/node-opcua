// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UADevice, UADevice_Base } from "node-opcua-nodeset-di/source/ua_device"
/**
 * Drives (multi-slot or single-slot axis amplifier)
 * mounted in a controller cabinet or a motion
 * device.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:DriveType ns=7;i=17793                          |
 * |isAbstract      |false                                             |
 */
export interface UADrive_Base extends UADevice_Base {
    /**
     * productCode
     * The ProductCode property provides a unique
     * combination of numbers and letters used to
     * identify the product. It may be the order
     * information displayed on type shields or in ERP
     * systems.
     */
    productCode: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UADrive extends Omit<UADevice, "productCode">, UADrive_Base {
}