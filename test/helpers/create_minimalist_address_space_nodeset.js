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
var ObjectIds          = require("lib/opcua_node_ids").ObjectIds;
var DataTypeIds          = require("lib/opcua_node_ids").DataTypeIds;


module.exports =  function create_minimalist_address_space_nodeset(addressSpace) {

    resolveNodeId(ObjectTypeIds.BaseObjectType).toString().should.eql("ns=0;i=58");



    var baseObjectType = addressSpace._createNode({
        browseName: "BaseObjectType",
        nodeId: resolveNodeId(ObjectTypeIds.BaseObjectType),
        nodeClass: NodeClass.ObjectType,
        isAbstract: true
    });

    var baseVariableType = addressSpace._createNode({
        browseName: "BaseVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseVariableType),
        nodeClass: NodeClass.VariableType,
        isAbstract: true
    });

    var propertyType = addressSpace.addVariableType({
        browseName: "PropertyType",
        subtypeOf: baseVariableType,
    });

    var baseDataVariableType = addressSpace._createNode({
        browseName: "BaseDataVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseDataVariableType),
        nodeClass: NodeClass.VariableType,
        subtypeOf: baseVariableType.nodeId,
        isAbstract: true
    });

    var hasSubtypeReferenceType = addressSpace._createNode({
        browseName: "HasSubtype",
        inverseName: "SubtypeOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasSubtype),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var organizesReferenceType = addressSpace._createNode({
        browseName: "Organizes",
        inverseName: "OrganizedBy",
        nodeId: resolveNodeId(ReferenceTypeIds.Organizes),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var hasComponenentReferenceType = addressSpace._createNode({
        browseName: "HasComponent",
        inverseName: "ComponentOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasComponent),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var hasPropertyReferenceType = addressSpace._createNode({
        browseName: "HasProperty",
        inverseName: "PropertyOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasProperty),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    var hasTypeDefinitionReferenceType = addressSpace._createNode({
        browseName: "HasTypeDefinition",
        inverseName: "TypeDefinitionOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasTypeDefinition),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });

    var rootFolder = addressSpace._createNode({
        browseName: "RootFolder",
        nodeId: resolveNodeId(ObjectIds.RootFolder),
        nodeClass: NodeClass.Object
    });

    var objectsFolder = addressSpace.addObject({
        browseName: "Objects",
        nodeId: resolveNodeId(ObjectIds.ObjectsFolder),
        organizedBy: rootFolder
    });

    rootFolder.objects.browseName.toString().should.eql("Objects");

    var dataTypeFolder = addressSpace.addObject({
        browseName: "DataType",
        nodeId: resolveNodeId(ObjectIds.DataTypesFolder),
        organizedBy: rootFolder
    });
    var doubleDataType = addressSpace._createNode({
        browseName: "Double",
        nodeId: resolveNodeId(DataTypeIds.Double),
        organisedBy: dataTypeFolder,
        nodeClass: NodeClass.DataType
    })


};


