// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ObligationType ns=10;i=1002                    |
 * |isAbstract      |false                                             |
 */
export interface UAObligation_Base {
    endUserObligated: UABaseDataVariable<boolean, DataType.Boolean>;
    machineBuilderObligated: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAObligation extends UAObject, UAObligation_Base {
}