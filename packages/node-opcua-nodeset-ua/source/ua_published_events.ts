import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTContentFilter } from "./dt_content_filter";
import type { DTSimpleAttributeOperand } from "./dt_simple_attribute_operand";
import type { UAPublishedDataSet, UAPublishedDataSet_Base } from "./ua_published_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PublishedEventsType i=14572                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAPublishedEvents_Base extends UAPublishedDataSet_Base {
    "$eventNotifier": UAProperty<NodeId, DataType.NodeId>;
    selectedFields: UAProperty<DTSimpleAttributeOperand[], DataType.ExtensionObject>;
    filter: UAProperty<DTContentFilter, DataType.ExtensionObject>;
    modifyFieldSelection?: UAMethod;
}
export interface UAPublishedEvents extends UAPublishedDataSet, UAPublishedEvents_Base {}