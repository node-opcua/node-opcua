import type { UAObject } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ObligationType i=1002                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAObligation_Base {
    endUserObligated: UABaseDataVariable<boolean, DataType.Boolean>;
    machineBuilderObligated: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAObligation extends UAObject, UAObligation_Base {}