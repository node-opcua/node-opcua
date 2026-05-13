import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/dist/ua_transition_event";
import type { DataType } from "node-opcua-variant";

import type { EnumPartQuality } from "./enum_part_quality";
import type { EnumProcessIrregularity } from "./enum_process_irregularity";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionPartTransitionEventType i=27                      |
 * |isAbstract      |true                                                        |
 */
export interface UAProductionPartTransitionEvent_Base extends UATransitionEvent_Base {
    customerOrderIdentifier?: UAProperty<UAString, DataType.String>;
    identifier?: UAProperty<UAString, DataType.String>;
    jobIdentifier: UAProperty<UAString, DataType.String>;
    name: UAProperty<UAString, DataType.String>;
    partQuality: UABaseDataVariable<EnumPartQuality, DataType.Int32>;
    processIrregularity: UABaseDataVariable<EnumProcessIrregularity, DataType.Int32>;
}
export interface UAProductionPartTransitionEvent extends UATransitionEvent, UAProductionPartTransitionEvent_Base {}