// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EnumNamingRule } from "./enum_naming_rule"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ModellingRuleType ns=0;i=77                       |
 * |isAbstract      |false                                             |
 */
export interface UAModellingRule_Base {
    namingRule: UAProperty<EnumNamingRule, /*z*/DataType.Int32>;
}
export interface UAModellingRule extends UAObject, UAModellingRule_Base {
}