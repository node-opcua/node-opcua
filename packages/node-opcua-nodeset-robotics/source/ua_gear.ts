// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTRationalNumber } from "node-opcua-nodeset-ua/source/dt_rational_number"
import { UARationalNumber } from "node-opcua-nodeset-ua/source/ua_rational_number"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
/**
 * The GearType describes a gear in a powertrain,
 * e.g. a gear box or a spindle.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:GearType ns=7;i=1022                            |
 * |isAbstract      |false                                             |
 */
export interface UAGear_Base extends UAComponent_Base {
    manufacturer: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    model: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    productCode: UAProperty<UAString, /*z*/DataType.String>;
    serialNumber: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * gearRatio
     * The transmission ratio of the gear expressed as a
     * fraction as input velocity (motor side) by output
     * velocity (load side).
     */
    gearRatio: UARationalNumber<DTRationalNumber>;
    /**
     * pitch
     * Pitch describes the distance covered in
     * millimeters (mm) for linear motion per one
     * revolution of the output side of the driving
     * unit. Pitch is used in combination with GearRatio
     * to describe the overall transmission from input
     * to output of the gear.
     */
    pitch?: UABaseDataVariable<number, /*z*/DataType.Double>;
}
export interface UAGear extends Omit<UAComponent, "manufacturer"|"model"|"productCode"|"serialNumber">, UAGear_Base {
}