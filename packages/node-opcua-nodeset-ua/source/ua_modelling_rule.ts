// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ModellingRuleType ns=0;i=77                       |
 * |isAbstract      |false                                             |
 */
export interface UAModellingRule_Base {
    namingRule: UAProperty<any, any>;
}
export interface UAModellingRule extends UAObject, UAModellingRule_Base {
}