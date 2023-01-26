// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { DTWwMessageArgument } from "./dt_ww_message_argument"
import { EnumWwEventCategory } from "./enum_ww_event_category"
/**
 * The interface definition IWwEventMessageType
 * describes the common extensions for all events
 * and conditions. Each instance definition that
 * includes this interface with a HasInterface
 * reference defines the predefined extensions
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:IWwEventMessageType ns=12;i=1002               |
 * |isAbstract      |true                                              |
 */
export interface UAIWwEventMessage_Base extends UABaseInterface_Base {
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
     * SourceName. Example:  “Machine”, “FixedSide”,
     * “Sizing”, “Milling1”
     */
    pathParts: UAProperty<UAString[], DataType.String>;
}
export interface UAIWwEventMessage extends UABaseInterface, UAIWwEventMessage_Base {
}