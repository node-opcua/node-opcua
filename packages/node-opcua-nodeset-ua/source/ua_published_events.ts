// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { DTSimpleAttributeOperand } from "./dt_simple_attribute_operand"
import { DTContentFilter } from "./dt_content_filter"
import { DTArgument } from "./dt_argument"
import { UAPublishedDataSet, UAPublishedDataSet_Base } from "./ua_published_data_set"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PublishedEventsType ns=0;i=14572                  |
 * |isAbstract      |false                                             |
 */
export interface UAPublishedEvents_Base extends UAPublishedDataSet_Base {
    "$eventNotifier": UAProperty<NodeId, /*z*/DataType.NodeId>;
    selectedFields: UAProperty<DTSimpleAttributeOperand[], /*z*/DataType.ExtensionObject>;
    filter: UAProperty<DTContentFilter, /*z*/DataType.ExtensionObject>;
    modifyFieldSelection?: UAMethod;
}
export interface UAPublishedEvents extends UAPublishedDataSet, UAPublishedEvents_Base {
}