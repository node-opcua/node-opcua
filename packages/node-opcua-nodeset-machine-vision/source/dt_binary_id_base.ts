// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:BinaryIdBaseDataType                            |
 * | isAbstract|true                                              |
 */
export interface DTBinaryIdBase extends DTStructure  {
/** Id is a system-wide unique name for identifying the recipe.*/
  id: UAString; // String ns=4;i=3017
/** Represents an optional version number of the identified recipe. It is recommended to be of the format Major.minor.patch.build or a subset thereof, but the actual format is implementation defined.*/
  version: UAString; // String ns=4;i=3017
/** Represents an optional hash of the binary content of the actual recipe (as it would be transmitted by the transfer methods).
The hash is supposed to be provided by the environment if existing. The environment shall use the same hash function on all recipes so that a difference in the hash indicates a difference in the recipe. It is recommended to use the SHA-256 algorithm for computing the hash, however, the actual algorithm is implementation-defined.*/
  hash: Buffer; // ByteString ns=0;i=15
/** Name of the hash function used. Required if internally and externally computed hashes are to be compared.*/
  hashAlgorithm: UAString; // String ns=0;i=12
/** Optional short human readable description of the configuration.*/
  description: LocalizedText; // LocalizedText ns=0;i=21
}