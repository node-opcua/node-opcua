import type { UALifetimeVariable } from "node-opcua-nodeset-di/dist/ua_lifetime_variable";
import type { UAMachineryOperationCounter, UAMachineryOperationCounter_Base } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LADSOperationCountersType i=1034                            |
 * |isAbstract      |false                                                       |
 */
export interface UALADSOperationCounters_Base extends UAMachineryOperationCounter_Base {
    lifeTime?: UALifetimeVariable<any, any>;
}
export interface UALADSOperationCounters extends UAMachineryOperationCounter, UALADSOperationCounters_Base {}