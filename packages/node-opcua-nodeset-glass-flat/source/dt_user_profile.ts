// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Glass/Flat/           |
 * | nodeClass |DataType                                          |
 * | name      |13:UserProfileType                                |
 * | isAbstract|false                                             |
 */
export interface DTUserProfile extends DTStructure {
  name: UAString; // String ns=0;i=12
  loginTime: Date; // DateTime ns=0;i=13
  language: UAString; // String ns=0;i=295
  measurementFormat: UAString; // String ns=0;i=12
  accessLevel: UAString; // String ns=0;i=12
  opcUaUser: boolean; // Boolean ns=0;i=1
}