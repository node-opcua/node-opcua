// ----- this file has been automatically generated - do not edit
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UACoffeeMachineParameter } from "./ua_coffee_machine_parameter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CoffeeMachineDeviceType i=1024                              |
 * |isAbstract      |false                                                       |
 */
export interface UACoffeeMachineDevice_Base extends UACommercialKitchenDevice_Base {
   // PlaceHolder for $RecipeName$
    parameters: UACoffeeMachineParameter;
}
export interface UACoffeeMachineDevice extends UACommercialKitchenDevice, UACoffeeMachineDevice_Base {
}