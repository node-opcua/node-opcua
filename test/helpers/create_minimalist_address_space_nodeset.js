/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var ObjectTypeIds      = require("lib/opcua_node_ids").ObjectTypeIds;
var VariableTypeIds    = require("lib/opcua_node_ids").VariableTypeIds;
var ReferenceTypeIds   = require("lib/opcua_node_ids").ReferenceTypeIds;


module.exports =  function create_minimalist_address_space_nodeset(the_address_space) {

    resolveNodeId(ObjectTypeIds.BaseObjectType).toString().should.eql("ns=0;i=58");


    var baseObjectType = the_address_space._createNode({
        browseName: "BaseObjectType",
        nodeId: resolveNodeId(ObjectTypeIds.BaseObjectType),
        nodeClass: NodeClass.ObjectType,
        isAbstract: true
    });

    var baseVariableType = the_address_space._createNode({
        browseName: "BaseVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseVariableType),
        nodeClass: NodeClass.VariableType,
        isAbstract: true
    });

    var baseDataVariableType = the_address_space._createNode({
        browseName: "BaseDataVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseDataVariableType),
        nodeClass: NodeClass.VariableType,
        subtypeOf: baseVariableType.nodeId,
        isAbstract: true
    });

    var hasSubtypeReferenceType = the_address_space._createNode({
        browseName: "HasSubtype",
        inverseName: "SubtypeOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasSubtype),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var organizesReferenceType = the_address_space._createNode({
        browseName: "Organizes",
        inverseName: "OrganizedBy",
        nodeId: resolveNodeId(ReferenceTypeIds.Organizes),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var hasComponenentReferenceType = the_address_space._createNode({
        browseName: "HasComponent",
        inverseName: "ComponentOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasComponent),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var hasPropertyReferenceType = the_address_space._createNode({
        browseName: "HasProperty",
        inverseName: "PropertyOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasProperty),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var hasTypeDefinitionReferenceType = the_address_space._createNode({
        browseName: "HasTypeDefinition",
        inverseName: "TypeDefinitionOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasTypeDefinition),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });

}

