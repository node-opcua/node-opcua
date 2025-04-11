// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"

/**
 * AddIn to link documentation provided by the
 * manufacturer and / or end-user.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DocumentationLinksType i=1011                               |
 * |isAbstract      |false                                                       |
 */
export interface UADocumentationLinks_Base {
   // PlaceHolder for $Link$
    addLink?: UAMethod;
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    removeLink?: UAMethod;
}
export interface UADocumentationLinks extends UAObject, UADocumentationLinks_Base {
}