// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ChannelModifierType ns=10;i=33                 |
 * |isAbstract      |false                                             |
 */
export interface UAChannelModifier_Base {
    blockSkip?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    dryRun: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    optionalStop: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    singleStep: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    testMode?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
}
export interface UAChannelModifier extends UAObject, UAChannelModifier_Base {
}