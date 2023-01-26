// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SignedSoftwareCertificate                         |
 * | isAbstract|false                                             |
 */
export interface DTSignedSoftwareCertificate extends DTStructure {
  certificateData: Buffer; // ByteString ns=0;i=15
  signature: Buffer; // ByteString ns=0;i=15
}
export interface UDTSignedSoftwareCertificate extends ExtensionObject, DTSignedSoftwareCertificate {};