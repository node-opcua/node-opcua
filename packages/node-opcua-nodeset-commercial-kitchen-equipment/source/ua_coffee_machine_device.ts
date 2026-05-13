import type { UACoffeeMachineParameter } from "./ua_coffee_machine_parameter";
import type { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device";

// ----- this file has been automatically generated - do not edit

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
export interface UACoffeeMachineDevice extends UACommercialKitchenDevice, UACoffeeMachineDevice_Base {}