import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAGlassEvent, UAGlassEvent_Base } from "./ua_glass_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IntermediateStepEvent i=1029                                |
 * |isAbstract      |true                                                        |
 */
export interface UAIntermediateStepEvent_Base extends UAGlassEvent_Base {
    processStep?: UAProperty<UAString, DataType.String>;
    status?: UAProperty<UAString, DataType.String>;
}
export interface UAIntermediateStepEvent extends UAGlassEvent, UAIntermediateStepEvent_Base {}