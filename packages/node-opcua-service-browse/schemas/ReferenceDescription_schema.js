"use strict";

var factories = require("node-opcua-factory");

var NodeClass = require("node-opcua-data-model").NodeClass;
var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var ReferenceDescription_Schema = {
    name: "ReferenceDescription",
    documentation: "The description of a reference.",
    id: factories.next_available_id(),
    fields: [
        {name: "referenceTypeId", fieldType: "NodeId",         documentation: "The type of references."},
        {name: "isForward",       fieldType: "Boolean",        documentation: "TRUE if the reference is a forward reference."},
        {name: "nodeId",          fieldType: "ExpandedNodeId", documentation: "The id of the target node."},
        {name: "browseName",      fieldType: "QualifiedName",  documentation: "The browse name of the target node."},
        {name: "displayName",     fieldType: "LocalizedText",  documentation: "The display name of the target node."},
        {name: "nodeClass",       fieldType: "NodeClass",      defaultValue:NodeClass.Unspecified, documentation: "The node class of the target node."},
        {name: "typeDefinition",  fieldType: "ExpandedNodeId", documentation: "The type definition of the target node."}

    ]
};
exports.ReferenceDescription_Schema = ReferenceDescription_Schema;


