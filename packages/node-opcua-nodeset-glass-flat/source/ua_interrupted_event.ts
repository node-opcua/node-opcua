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
 * |typedDefinition |InterruptedEventType i=1032                                 |
 * |isAbstract      |true                                                        |
 */
export interface UAInterruptedEvent_Base extends UAGlassEvent_Base {
    processName?: UAProperty<UAString, DataType.String>;
}
export interface UAInterruptedEvent extends UAGlassEvent, UAInterruptedEvent_Base {}