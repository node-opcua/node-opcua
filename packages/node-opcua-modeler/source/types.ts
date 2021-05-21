import { UAObject, UAVariableT, UAAddressSpaceFileType, RolePermissionType } from "node-opcua-address-space";
import { DataType } from "node-opcua-variant";
import { NumericRange } from "node-opcua-numeric-range";

export type IdType = any;
/*
 * The BrowseName of instances of this type shall be derived from the represented namespace.
 * This can, for example, be done by using the index of the namespace in the NamespaceArray
 * as namespaceIndex of the QualifiedName and the namespace URI as name of the
 * QualifiedName.
*/
export interface UANamespaceMetadataType extends UAObject {


    /**
    * The NamespaceUri Property contains the namespace represented by an instance of the MetaDataType.
    */
    _namespaceUri: UAVariableT<string, DataType.String>;
    /**
     * The NamespaceVersion Property provides version information for the namespace.It is intended
     * for display purposes and shall not be used to programmatically identify the latest version.If
     * there is no formal version defined for the namespace this Property shall be set to a null String.
     */
    namespaceVersion: UAVariableT<string, DataType.String>;
    /*
    * The NamespacePublicationDate Property provides the publication date of the namespace
    * version.This Property value can be used by Clients to determine the latest version if different
     * versions are provided by different Servers.If there is no formal publication date defined for the
     * namespace this Property shall be set to a null DateTime.
    */
    namespacePublicationDate: UAVariableT<Date, DataType.DateTime>;
    /**
     *  The IsNamespaceSubset Property defines whether all Nodes of the namespace are accessible
     *  in the Server or only a subset.It is set to FALSE if the full namespace is provided and TRUE if
     *  not.If the completeness is unknown then this Property shall be set to TRUE.
     */
    isNamespaceSubset: UAVariableT<boolean, DataType.Boolean>;

    /*
    * Static Nodes are identical for all Attributes in all Servers, including the Value Attribute.For
    * TypeDefinitionNodes, also the InstanceDeclarations shall be identical.That means that for
    *      static Nodes the semantic is always the same.Namespaces with static Nodes are for example
    * namespaces defined by standard bodies like the OPC Foundation.This is important information
    * for aggregating Servers.If the namespace is dynamic and used in several Servers the
    * aggregating Server needs to distinguish the namespace for each aggregated Server.The static
    * Nodes of a namespace only need to be handled once, even if they are used by several
    * aggregated Servers.
     */
    /**
     * The StaticNodeIdTypes Property provides a list of IdTypes used for static Nodes.All Nodes in
     * the AddressSpace of the namespace using one of the IdTypes in the array shall be static Nodes.
     */
    staticNodeIdTypes: UAVariableT<IdType[], DataType.ExtensionObject>;
    /**
     * The StaticNumericNodeIdRange Property provides a list of NumericRanges used for numeric
     * NodeIds of static Nodes.If the StaticNodeIdTypes Property contains an entry for numeric
     * NodeIds then this Property is ignored.
     */
    staticNumericNodeIdRange: UAVariableT<NumericRange[], DataType.ExtensionObject>

    /**
    * The StaticStringNodeIdPattern Property provides a regular expression as defined for the Like
    * Operator defined in Part 4 to filter for string NodeIds of static Nodes.If the StaticNodeIdTypes
    * Property contains an entry for string NodeIds then this Property is ignored.
    */
    staticStringNodeIdPattern: UAVariableT<string, DataType.String>;

    /**
     * The Object NamespaceFile contains all Nodes and References of the namespace in an XML
     * file where the Information Model XML Schema is defined in Part 6. The XML file is provided
     * through an AddressSpaceFileType Object. 
     */
    namespaceFile?: UAAddressSpaceFileType; // AddressSpaceFileType
    /**
     * The DefaultRolePermissions Property provides the default permissions if a Server supports 
     * RolePermissions for the Namespace. A Node in the Namespace overrides this default by adding
     * a RolePermissions Attribute to the Node. If a Server implements a vendor-specific
     * RolePermissions model for a Namespace, it does not add the DefaultRolePermissions Property
     * to the NamespaceMetadata Object.  
     * */
    defaultRolePermissions?: UAVariableT<RolePermissionType[], DataType.ExtensionObject>;
    /**
     * The DefaultUserRolePermissions Property provides the default user permissions if a Server
     * supports UserRolePermissions for the Namespace. A Node in the Namespace overrides this
     * default by adding a UserRolePermissions Attribute to the Node. If a Server implements a
     * vendor-specific UserRolePermissions model for a Namespace, it does not add the
     * DefaultUserRolePermissions Property to the NamespaceMetadata Object. 
     */
    defaultUserRolePermissions?: UAVariableT<RolePermissionType[], DataType.ExtensionObject>;

    /**
     * The DefaultAccessRestrictions Property is present if a Server supports AccessRestrictions for
     * the Namespace and provides the defaults. A Node in the Namespace overrides this default by
     * adding a AccessRestrictions Attribute to the Node. If a Server implements a vendor-specific
     * AccessRestriction model for a Namespace, it does not add the DefaultAccessRestrictions
     * Property to the NamespaceMetadata Object. 
     */
    defaultAccessRestrictions?: UAVariableT<number, DataType.UInt16>;
}

