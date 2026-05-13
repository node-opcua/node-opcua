import type { UAProperty } from "node-opcua-address-space-base";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IFtnirOrFtirDeviceConditionSetType i=1100                   |
 * |isAbstract      |true                                                        |
 */
export interface UAIFtnirOrFtirDeviceConditionSet_Base extends UABaseInterface_Base {
    watchdog?: UAProperty<boolean, DataType.Boolean>;
    remainingDataStorageCapacity?: UAProperty<number, DataType.Float>;
}
export interface UAIFtnirOrFtirDeviceConditionSet extends UABaseInterface, UAIFtnirOrFtirDeviceConditionSet_Base {}