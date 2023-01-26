// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTWwMessageArgument } from "./dt_ww_message_argument"
import { EnumWwEventCategory } from "./enum_ww_event_category"
/**
 * The WwBaseEventType represents a message event
 * from a module
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:WwBaseEventType ns=12;i=13                     |
 * |isAbstract      |false                                             |
 */
export interface UAWwBaseEvent_Base extends UABaseEvent_Base {
    /**
     * arguments
     * The Arguments Variable is an argument value array
     * of one dimension that can be used to parameterize
     * the message. The number of the indexing in the
     * array corresponds to the placeholder number in
     * the message text. This ensures that the
     * formatting functions of the implementations
     * enable the localized message texts to be created.
     */
    arguments?: UAProperty<DTWwMessageArgument[], DataType.ExtensionObject>;
    /**
     * eventCategory
     * The EventCategory Variable provides the category
     * of the event.
     */
    eventCategory: UAProperty<EnumWwEventCategory, DataType.Int32>;
    /**
     * group
     * The Group Variable specifies the class or group
     * of the Message like “safety”, “emergency”,
     * “consumable”.  See chapter “Categorizing and
     * grouping the messages, events, alarms and
     * conditions”.
     */
    group?: UAProperty<UAString, DataType.String>;
    /**
     * localizedMessages
     * The LocalizedMessages Variable contains an array
     * of localized messages corresponding to the
     * installed server languages.
     */
    localizedMessages?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    /**
     * messageId
     * The MessageId Variable is a unique Identifier
     * like a number or name of the message in the cause
     * path (PathParts) determined Module. Example:
     * “A4711” or “1”
     */
    messageId: UAProperty<UAString, DataType.String>;
    /**
     * messageName
     * The MessageName Variable is a short name like a
     * number or title to reference a translation of the
     * general message text. Example:
     * “ID_MSG_EmergencyAlarm”.
     */
    messageName?: UAProperty<UAString, DataType.String>;
    /**
     * pathParts
     * The PathParts Variable is an array of Path
     * information strings based on a server independent
     * hierarchical structure of modules or an
     * application specific expansion of that. It is an
     * additional location infor¬mation beside the
     * SourceName.
     */
    pathParts: UAProperty<UAString[], DataType.String>;
}
export interface UAWwBaseEvent extends UABaseEvent, UAWwBaseEvent_Base {
}