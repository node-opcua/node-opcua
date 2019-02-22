/**
 * @module node-opcua-service-filter
 */
export * from "./imports";
export * from "./tools_event_filter";

// The SimpleAttributeOperand is a simplified form of the AttributeOperand and all of the rules that
// apply to the AttributeOperand also apply to the SimpleAttributeOperand. The examples provided in
// B.1 only use AttributeOperand, however, the AttributeOperand can be replaced by a
// SimpleAttributeOperand whenever all ReferenceTypes in the RelativePath are subtypes of
// HierarchicalReferences and the targets are Object or Variable Nodes and an Alias is not required

// typeDefinitionId
// This parameter restricts the operand to instances of the TypeDefinitionNode or
// one of its subtypes.
// { name: "typeDefinitionId", fieldType:"NodeId",documentation:"NodeId of a TypeDefinitionNode."},

// browsePath
// A relative path to a Node.
// This parameter specifies a relative path using a list of BrowseNames instead of
// the RelativePath structure used in the AttributeOperand. The list of
// BrowseNames is equivalent to a RelativePath that specifies forward references
// which are subtypes of the HierarchicalReferences ReferenceType.
// All Nodes followed by the browsePath shall be of the NodeClass Object or
// Variable.
// If this list is empty the Node is the instance of the TypeDefinition.
//  { name: "browsePath", isArray:true, fieldType:"QualifiedName"},

// Id of the Attribute. The IntegerId is defined in 7.13.
// The Value Attribute shall be supported by all Servers. The support of other
// Attributes depends on requirements set in Profiles or other parts of this
// specification.
// { name: "attributeId", fieldType:"IntegerId"},

// This parameter is used to identify a single element of an array, or a single range
// of indexes for an array. The first element is identified by index 0 (zero).
// This parameter is ignored if the selected Node is not a Variable or the Value of a
// Variable is not an array.
// The parameter is null if not specified.
// All values in the array are used if this parameter is not specified.
// The NumericRange type is defined in 7.21.
// { name: "indexRange", fieldType:"NumericRange"}
