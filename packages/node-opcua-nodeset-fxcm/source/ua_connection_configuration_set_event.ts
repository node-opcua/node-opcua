import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event.js";
import type { DataType } from "node-opcua-variant";

import type { EnumFxProcessEnum } from "./enum_fx_process_enum.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionConfigurationSetEventType i=1006                  |
 * |isAbstract      |true                                                        |
 */
export interface UAConnectionConfigurationSetEvent_Base extends UABaseEvent_Base {
    action: UAProperty<EnumFxProcessEnum, DataType.Int32>;
    connectionConfigurationSetNode: UAProperty<NodeId, DataType.NodeId>;
    name: UAProperty<UAString, DataType.String>;
}
export interface UAConnectionConfigurationSetEvent extends UABaseEvent, UAConnectionConfigurationSetEvent_Base {}