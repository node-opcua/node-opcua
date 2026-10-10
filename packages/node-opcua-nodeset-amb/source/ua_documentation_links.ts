import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { QualifiedName } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
    /**
     * addLink
     * Method to add an end-user specific link that is
     * stored persistently in the server.
     */
    addLink?: UAMethod;
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * removeLink
     * Method to remove an end-user specific link that
     * is managed in the server.
     */
    removeLink?: UAMethod;
}
export interface UADocumentationLinks extends UAObject, UADocumentationLinks_Base {}