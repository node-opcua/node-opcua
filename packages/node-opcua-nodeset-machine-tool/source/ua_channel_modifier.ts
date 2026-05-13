import type { UAObject } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ChannelModifierType i=33                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAChannelModifier_Base {
    blockSkip?: UABaseDataVariable<boolean, DataType.Boolean>;
    dryRun: UABaseDataVariable<boolean, DataType.Boolean>;
    optionalStop: UABaseDataVariable<boolean, DataType.Boolean>;
    singleStep: UABaseDataVariable<boolean, DataType.Boolean>;
    testMode?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAChannelModifier extends UAObject, UAChannelModifier_Base {}