// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTPublishedDataSetSource } from "./dt_published_data_set_source"
import { DTSimpleAttributeOperand } from "./dt_simple_attribute_operand"
import { DTContentFilter } from "./dt_content_filter"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PublishedEventsDataType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTPublishedEvents extends DTPublishedDataSetSource {
  eventNotifier: NodeId; // NodeId ns=0;i=17
  selectedFields: DTSimpleAttributeOperand[]; // ExtensionObject ns=0;i=601
  filter: DTContentFilter; // ExtensionObject ns=0;i=586
}
export interface UDTPublishedEvents extends ExtensionObject, DTPublishedEvents {};