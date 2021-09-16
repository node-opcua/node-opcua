// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionPartSetType ns=10;i=34               |
 * |isAbstract      |false                                             |
 */
export interface UAProductionPartSet_Base {
    containsMixedParts: UAProperty<boolean, /*z*/DataType.Boolean>;
    name?: UAProperty<UAString, /*z*/DataType.String>;
    partsCompletedPerRun: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    partsPerRun?: UAObject;
    partsPlannedPerRun: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAProductionPartSet extends UAObject, UAProductionPartSet_Base {
}