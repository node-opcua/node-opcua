import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16, UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAOrderedList } from "node-opcua-nodeset-ua/dist/ua_ordered_list";
import type { DataType } from "node-opcua-variant";

import type { UAProductionJobStateMachine } from "./ua_production_job_state_machine";

// ----- this file has been automatically generated - do not edit

export interface UAProductionJob_runsPlanned<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      isValid: UAProperty<boolean, DataType.Boolean>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionJobType i=29                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionJob_Base {
    customerOrderIdentifier?: UAProperty<UAString, DataType.String>;
    identifier: UAProperty<UAString, DataType.String>;
    numberInList: UAProperty<UInt16, DataType.UInt16>;
    orderIdentifier?: UAProperty<UAString, DataType.String>;
    partsCompleted?: UABaseDataVariable<UInt32, DataType.UInt32>;
    partSets?: UAObject;
    partsGood?: UABaseDataVariable<UInt32, DataType.UInt32>;
    productionPrograms: UAOrderedList;
    runsCompleted: UABaseDataVariable<UInt32, DataType.UInt32>;
    runsPlanned: UAProductionJob_runsPlanned<UInt32, DataType.UInt32>;
    state: UAProductionJobStateMachine;
}
export interface UAProductionJob extends UAObject, UAProductionJob_Base {}