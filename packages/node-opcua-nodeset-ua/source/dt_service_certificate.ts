// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ServiceCertificateDataType                                  |
 * | isAbstract|false                                                       |
 */
export interface DTServiceCertificate extends DTStructure {
  certificate: Buffer; // ByteString ns=0;i=15
  issuers: Buffer[]; // ByteString ns=0;i=15
  validFrom: Date; // DateTime ns=0;i=294
  validTo: Date; // DateTime ns=0;i=294
}
export interface UDTServiceCertificate extends ExtensionObject, DTServiceCertificate {};