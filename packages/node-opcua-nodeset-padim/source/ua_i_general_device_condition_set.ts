import type { UAObject } from "node-opcua-address-space-base";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";

import type { UAGeneralDeviceConditionSet } from "./ua_general_device_condition_set";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IGeneralDeviceConditionSetType i=1044                       |
 * |isAbstract      |true                                                        |
 */
export interface UAIGeneralDeviceConditionSet_Base extends UABaseInterface_Base {
    generalDeviceConditions?: UAGeneralDeviceConditionSet;
    deviceComponentConditions?: UAObject;
}
export interface UAIGeneralDeviceConditionSet extends UABaseInterface, UAIGeneralDeviceConditionSet_Base {}