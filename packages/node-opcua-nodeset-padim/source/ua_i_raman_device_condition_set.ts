// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IRamanDeviceConditionSetType i=1103                         |
 * |isAbstract      |true                                                        |
 */
export interface UAIRamanDeviceConditionSet_Base extends UABaseInterface_Base {
    watchdog?: UAProperty<boolean, DataType.Boolean>;
    remainingDataStorageCapacity?: UAProperty<number, DataType.Float>;
}
export interface UAIRamanDeviceConditionSet extends UABaseInterface, UAIRamanDeviceConditionSet_Base {
}