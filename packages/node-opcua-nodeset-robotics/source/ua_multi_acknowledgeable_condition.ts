// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAAcknowledgeableCondition, UAAcknowledgeableCondition_Base } from "node-opcua-nodeset-ua/dist/ua_acknowledgeable_condition"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MultiAcknowledgeableConditionType i=1015                    |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiAcknowledgeableCondition_Base extends UAAcknowledgeableCondition_Base {
    conditionDescriptions: UAProperty<LocalizedText[], DataType.LocalizedText>;
}
export interface UAMultiAcknowledgeableCondition extends UAAcknowledgeableCondition, UAMultiAcknowledgeableCondition_Base {
}