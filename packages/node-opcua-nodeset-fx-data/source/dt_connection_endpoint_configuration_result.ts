import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { StatusCode } from "node-opcua-status-code";

import type { EnumFunctionalEntityVerificationResultEnum } from "./enum_functional_entity_verification_result_enum.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionEndpointConfigurationResultDataType               |
 * | isAbstract|false                                                       |
 */
export interface DTConnectionEndpointConfigurationResult extends DTStructure {
  connectionEndpointId: NodeId; // NodeId ns=0;i=17
  functionalEntityNodeResult: StatusCode; // StatusCode ns=0;i=19
  connectionEndpointResult: StatusCode; // StatusCode ns=0;i=19
  verificationResult: EnumFunctionalEntityVerificationResultEnum; // Int32 ns=33;i=3002
  verificationStatus: StatusCode; // StatusCode ns=0;i=19
  verificationVariablesErrors: StatusCode[]; // StatusCode ns=0;i=19
  establishControlResult: StatusCode[]; // StatusCode ns=0;i=19
  configurationDataResult: StatusCode[]; // StatusCode ns=0;i=19
  reassignControlResult: StatusCode[]; // StatusCode ns=0;i=19
  communicationLinksResult: StatusCode; // StatusCode ns=0;i=19
  enableCommunicationResult: StatusCode; // StatusCode ns=0;i=19
}
export interface UDTConnectionEndpointConfigurationResult extends ExtensionObject, DTConnectionEndpointConfigurationResult {};