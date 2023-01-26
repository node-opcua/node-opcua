// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:ITagNameplateType ns=1;i=15048                  |
 * |isAbstract      |true                                              |
 */
export interface UAITagNameplate_Base extends UABaseInterface_Base {
    assetId?: UAProperty<UAString, DataType.String>;
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAITagNameplate extends UABaseInterface, UAITagNameplate_Base {
}