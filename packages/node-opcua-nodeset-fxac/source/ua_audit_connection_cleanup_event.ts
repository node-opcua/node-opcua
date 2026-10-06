import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTRelatedEndpoint } from "node-opcua-nodeset-fx-data/dist/dt_related_endpoint.js";
import type { DataType } from "node-opcua-variant";

import type { UAAuditUaFxEvent, UAAuditUaFxEvent_Base } from "./ua_audit_ua_fx_event.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditConnectionCleanupEventType i=1040                      |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditConnectionCleanupEvent_Base extends UAAuditUaFxEvent_Base {
    relatedEndpoint: UAProperty<DTRelatedEndpoint, DataType.ExtensionObject>;
    removedEndpoint: UAProperty<UAString, DataType.String>;
}
export interface UAAuditConnectionCleanupEvent extends UAAuditUaFxEvent, UAAuditConnectionCleanupEvent_Base {}