// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { Int64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAAcknowledgeableCondition, UAAcknowledgeableCondition_Base } from "node-opcua-nodeset-ua/source/ua_acknowledgeable_condition"
import { DTEntity } from "./dt_entity"
import { DTReportedValue } from "./dt_reported_value"
import { UAJoiningSystemEventContent } from "./ua_joining_system_event_content"
/**
 * The JoiningSystemConditionType is used to send
 * any type of events with acknowledgement mechanism
 * from a joining system.
 * Note: The type of event is determined by the
 * usage of respective Condition Class(es) and
 * Condition SubClass(es) properties defined in
 * 0:ConditionType.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JoiningSystemConditionType i=1020                           |
 * |isAbstract      |false                                                       |
 */
export interface UAJoiningSystemCondition_Base extends UAAcknowledgeableCondition_Base {
    /**
     * joiningSystemEventContent
     * JoiningSystemEventContent is the common payload
     * of the event from a joining system.
     */
    joiningSystemEventContent?: UAJoiningSystemEventContent<any, any>;
}
export interface UAJoiningSystemCondition extends UAAcknowledgeableCondition, UAJoiningSystemCondition_Base {
}