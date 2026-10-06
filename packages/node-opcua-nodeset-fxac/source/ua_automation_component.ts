import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { UALogObject } from "node-opcua-nodeset-ua/dist/ua_log_object.js";
import type { DataType } from "node-opcua-variant";

import type { DTAggregatedHealth } from "./dt_aggregated_health.js";
import type { UAAggregatedHealth } from "./ua_aggregated_health.js";
import type { UAAutomationComponentCapabilities } from "./ua_automation_component_capabilities.js";
import type { UAPublisherCapabilities } from "./ua_publisher_capabilities.js";
import type { UASubscriberCapabilities } from "./ua_subscriber_capabilities.js";

// ----- this file has been automatically generated - do not edit

export interface UAAutomationComponent_diagnostics extends UAFunctionalGroup { // Object
      closeCallCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      closeCallFailedCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      establishCallCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      establishCallFailedCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutomationComponentType i=2                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAAutomationComponent_Base {
    aggregatedHealth: UAAggregatedHealth<DTAggregatedHealth>;
    assets: UAFolder;
    automationComponentLog?: UALogObject;
    closeConnections: UAMethod;
    componentCapabilities: UAAutomationComponentCapabilities;
    conformanceName?: UAProperty<UAString, DataType.String>;
    descriptors: UAFolder;
    diagnostics?: UAAutomationComponent_diagnostics;
    establishConnections: UAMethod;
    functionalEntities: UAFolder;
    publisherCapabilities?: UAPublisherCapabilities;
    subscriberCapabilities?: UASubscriberCapabilities;
}
export interface UAAutomationComponent extends UAObject, UAAutomationComponent_Base {}