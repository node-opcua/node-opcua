import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UAMachineIdentification } from "node-opcua-nodeset-machinery/dist/ua_machine_identification";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * Definition of a machine according to the
 * Weihenstephan standards
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WSMachineType i=1000                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAWSMachine_Base {
    wsVersionVendor?: UAProperty<UAString, DataType.String>;
    wsVersionProject?: UAProperty<UAString, DataType.String>;
    counters?: UAFunctionalGroup;
    batchAndArticleTracing?: UAFunctionalGroup;
    operatingModes?: UAFunctionalGroup;
    operatingStates?: UAFunctionalGroup;
    programs?: UAFunctionalGroup;
    alarms?: UAFunctionalGroup;
    measuredValues?: UAFunctionalGroup;
    parameters?: UAFunctionalGroup;
    warnings?: UAFunctionalGroup;
    wsVersion: UAProperty<UAString, DataType.String>;
    identification: UAMachineIdentification;
    wsMachineProfile: UAProperty<UAString, DataType.String>;
    computedValues?: UAFunctionalGroup;
}
export interface UAWSMachine extends UAObject, UAWSMachine_Base {}