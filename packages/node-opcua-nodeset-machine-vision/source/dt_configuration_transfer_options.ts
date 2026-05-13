import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTConfigurationId } from "./dt_configuration_id";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision                   |
 * | nodeClass |DataType                                                    |
 * | name      |ConfigurationTransferOptions                                |
 * | isAbstract|false                                                       |
 */
export interface DTConfigurationTransferOptions extends DTStructure {
  /** The Id of the configuration to be transferred to or from the client.*/
  internalId: DTConfigurationId; // ExtensionObject ns=4;i=3008
}
export interface UDTConfigurationTransferOptions extends ExtensionObject, DTConfigurationTransferOptions {};