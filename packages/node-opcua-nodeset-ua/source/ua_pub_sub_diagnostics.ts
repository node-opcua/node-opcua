import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumDiagnosticsLevel } from "./enum_diagnostics_level";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAPubSubDiagnosticsCounter } from "./ua_pub_sub_diagnostics_counter";

// ----- this file has been automatically generated - do not edit

export interface UAPubSubDiagnostics_counters extends UAObject { // Object
      stateError: UAPubSubDiagnosticsCounter<UInt32>;
      stateOperationalByMethod: UAPubSubDiagnosticsCounter<UInt32>;
      stateOperationalByParent: UAPubSubDiagnosticsCounter<UInt32>;
      stateOperationalFromError: UAPubSubDiagnosticsCounter<UInt32>;
      statePausedByParent: UAPubSubDiagnosticsCounter<UInt32>;
      stateDisabledByMethod: UAPubSubDiagnosticsCounter<UInt32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubDiagnosticsType i=19677                               |
 * |isAbstract      |true                                                        |
 */
export interface UAPubSubDiagnostics_Base {
    diagnosticsLevel: UABaseDataVariable<EnumDiagnosticsLevel, DataType.Int32>;
    totalInformation: UAPubSubDiagnosticsCounter<UInt32>;
    totalError: UAPubSubDiagnosticsCounter<UInt32>;
    reset: UAMethod;
    subError: UABaseDataVariable<boolean, DataType.Boolean>;
    counters: UAPubSubDiagnostics_counters;
    liveValues: UAObject;
}
export interface UAPubSubDiagnostics extends UAObject, UAPubSubDiagnostics_Base {}