// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:PrognosisType ns=10;i=3                        |
 * |isAbstract      |true                                              |
 */
export interface UAPrognosis_Base {
    predictedTime: UAProperty<Date, /*z*/DataType.DateTime>;
}
export interface UAPrognosis extends UAObject, UAPrognosis_Base {
}