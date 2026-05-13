import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumPartQuality } from "./enum_part_quality";
import type { EnumProcessIrregularity } from "./enum_process_irregularity";
import type { UAProductionPartStateMachine } from "./ua_production_part_state_machine";

// ----- this file has been automatically generated - do not edit

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
export interface UAProductionPart extends UAObject, UAProductionPart_Base {}