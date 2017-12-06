/* global describe,it,before*/

var should = require("should");



var DataType = require("node-opcua-variant").DataType;

var NodeClass = require("node-opcua-data-model").NodeClass;

var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

var ObjectTypeIds      = require("node-opcua-constants").ObjectTypeIds;
var VariableTypeIds    = require("node-opcua-constants").VariableTypeIds;
var ReferenceTypeIds   = require("node-opcua-constants").ReferenceTypeIds;
var ObjectIds          = require("node-opcua-constants").ObjectIds;
var DataTypeIds          = require("node-opcua-constants").DataTypeIds;


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


