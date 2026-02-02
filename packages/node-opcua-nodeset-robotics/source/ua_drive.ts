// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
/**
 * Drives (multi-slot or single-slot axis amplifier)
 * mounted in a controller cabinet or a motion
 * device.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DriveType i=17793                                           |
 * |isAbstract      |false                                                       |
 */
export interface UADrive_Base extends UAComponent_Base {
    assetId?: UAProperty<UAString, DataType.String>;
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
export interface UADrive extends Omit<UAComponent, "assetId"|"productCode">, UADrive_Base {
}