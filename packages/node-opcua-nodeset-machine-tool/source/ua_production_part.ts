// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { EnumPartQuality } from "./enum_part_quality"
import { EnumProcessIrregularity } from "./enum_process_irregularity"
import { UAProductionPartStateMachine } from "./ua_production_part_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionPartType i=56                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionPart_Base {
    customerOrderIdentifier?: UAProperty<UAString, DataType.String>;
    identifier?: UAProperty<UAString, DataType.String>;
    name: UAProperty<UAString, DataType.String>;
    partQuality: UABaseDataVariable<EnumPartQuality, DataType.Int32>;
    processIrregularity: UABaseDataVariable<EnumProcessIrregularity, DataType.Int32>;
    state?: UAProductionPartStateMachine;
}
export interface UAProductionPart extends UAObject, UAProductionPart_Base {
}