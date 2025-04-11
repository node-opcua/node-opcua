// ----- this file has been automatically generated - do not edit
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAMicrowaveCombiOvenParameter } from "./ua_microwave_combi_oven_parameter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MicrowaveCombiOvenDeviceType i=1034                         |
 * |isAbstract      |false                                                       |
 */
export interface UAMicrowaveCombiOvenDevice_Base extends UACommercialKitchenDevice_Base {
    microwaveCombiOven: UAMicrowaveCombiOvenParameter;
}
export interface UAMicrowaveCombiOvenDevice extends UACommercialKitchenDevice, UAMicrowaveCombiOvenDevice_Base {
}