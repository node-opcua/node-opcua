// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * This structure contains aggregated information to
 * identify one or more Tags corresponding to the
 * Tags attribute defined in ResultType and
 * ResultDataType.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:TagDataType                                    |
 * | isAbstract|false                                             |
 */
export interface DTTag extends DTStructure {
/** The mandatory Name is the type of the identifier. It can be empty if a system could not determine the identifier. If it is empty, it is the application responsibility to handle the received Tag.*/
  name: UAString; // String ns=0;i=12
/** The mandatory Value is the identifier of the tag corresponding to the Name attribute.*/
  value: UAString; // String ns=0;i=12
}