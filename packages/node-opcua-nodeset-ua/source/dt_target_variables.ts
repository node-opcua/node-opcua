import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTFieldTarget } from "./dt_field_target";
import type { DTSubscribedDataSet } from "./dt_subscribed_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |TargetVariablesDataType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTTargetVariables extends DTSubscribedDataSet {
  targetVariables: DTFieldTarget[]; // ExtensionObject ns=0;i=14744
}
export interface UDTTargetVariables extends ExtensionObject, DTTargetVariables {};