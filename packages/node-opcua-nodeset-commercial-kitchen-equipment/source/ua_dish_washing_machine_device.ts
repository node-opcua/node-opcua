import type { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device";
import type { UADishWashingMachineProgramParameter } from "./ua_dish_washing_machine_program_parameter";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DishWashingMachineDeviceType i=1026                         |
 * |isAbstract      |false                                                       |
 */
export interface UADishWashingMachineDevice_Base extends UACommercialKitchenDevice_Base {
    parameters: UADishWashingMachineProgramParameter;
}
export interface UADishWashingMachineDevice extends UACommercialKitchenDevice, UADishWashingMachineDevice_Base {}