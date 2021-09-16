// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTConfigurationId } from "./dt_configuration_id"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ConfigurationTransferOptions                    |
 * | isAbstract|false                                             |
 */
export interface DTConfigurationTransferOptions extends DTStructure  {
/** The Id of the configuration to be transferred to or from the client.*/
  internalId: DTConfigurationId; // ExtensionObject ns=4;i=3008
}