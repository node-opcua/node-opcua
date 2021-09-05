// ----- this file has been automatically generated - do not edit
import { DTSubscribedDataSet } from "./dt_subscribed_data_set"
import { DTFieldTarget } from "./dt_field_target"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |TargetVariablesDataType                           |
 * | isAbstract|false                                             |
 */
export interface DTTargetVariables extends DTSubscribedDataSet  {
  targetVariables: DTFieldTarget[]; // ExtensionObject ns=0;i=14744
}