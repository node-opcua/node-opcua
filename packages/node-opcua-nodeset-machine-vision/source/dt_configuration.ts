// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTConfigurationId } from "./dt_configuration_id"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ConfigurationDataType                           |
 * | isAbstract|false                                             |
 */
export interface DTConfiguration extends DTStructure  {
/** Indicates that actual content of the configuration may be transferred through temporary file transfer method.*/
  hasTransferableDataOnFile: boolean; // Boolean ns=0;i=1
/** Identification of the configuration used by the environment. This argument must not be empty.*/
  externalId: DTConfigurationId; // ExtensionObject ns=4;i=3008
/** System-wide unique ID for identifying a configuration. This ID is assigned by the vision system.*/
  internalId: DTConfigurationId; // ExtensionObject ns=4;i=3008
/** The time and date when this configuration was last modified.*/
  lastModified: Date; // DateTime ns=0;i=294
}