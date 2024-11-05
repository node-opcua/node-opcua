// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAGeneralDeviceConditionSet } from "./ua_general_device_condition_set"
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
export interface UAIGeneralDeviceConditionSet extends UABaseInterface, UAIGeneralDeviceConditionSet_Base {
}