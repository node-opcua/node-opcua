/* global describe,it,before*/

const should = require("should");



const DataType = require("node-opcua-variant").DataType;

const NodeClass = require("node-opcua-data-model").NodeClass;

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

const ObjectTypeIds      = require("node-opcua-constants").ObjectTypeIds;
const VariableTypeIds    = require("node-opcua-constants").VariableTypeIds;
const ReferenceTypeIds   = require("node-opcua-constants").ReferenceTypeIds;
const ObjectIds          = require("node-opcua-constants").ObjectIds;
const DataTypeIds          = require("node-opcua-constants").DataTypeIds;


module.exports =  function create_minimalist_address_space_nodeset(addressSpace) {

    resolveNodeId(ObjectTypeIds.BaseObjectType).toString().should.eql("ns=0;i=58");



    const baseObjectType = addressSpace._createNode({
        browseName: "BaseObjectType",
        nodeId: resolveNodeId(ObjectTypeIds.BaseObjectType),
        nodeClass: NodeClass.ObjectType,
        isAbstract: true
    });

    const baseVariableType = addressSpace._createNode({
        browseName: "BaseVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseVariableType),
        nodeClass: NodeClass.VariableType,
        isAbstract: true
    });

    const propertyType = addressSpace.addVariableType({
        browseName: "PropertyType",
        subtypeOf: baseVariableType,
    });

    const baseDataVariableType = addressSpace._createNode({
        browseName: "BaseDataVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseDataVariableType),
        nodeClass: NodeClass.VariableType,
        subtypeOf: baseVariableType.nodeId,
        isAbstract: true
    });

    const hasSubtypeReferenceType = addressSpace._createNode({
        browseName: "HasSubtype",
        inverseName: "SubtypeOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasSubtype),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    const organizesReferenceType = addressSpace._createNode({
        browseName: "Organizes",
        inverseName: "OrganizedBy",
        nodeId: resolveNodeId(ReferenceTypeIds.Organizes),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    const hasComponenentReferenceType = addressSpace._createNode({
        browseName: "HasComponent",
        inverseName: "ComponentOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasComponent),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    const hasPropertyReferenceType = addressSpace._createNode({
        browseName: "HasProperty",
        inverseName: "PropertyOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasProperty),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });
    const hasTypeDefinitionReferenceType = addressSpace._createNode({
        browseName: "HasTypeDefinition",
        inverseName: "TypeDefinitionOf",
        nodeId: resolveNodeId(ReferenceTypeIds.HasTypeDefinition),
        nodeClass: NodeClass.ReferenceType,
        isAbstract: true
    });

    const rootFolder = addressSpace._createNode({
        browseName: "RootFolder",
        nodeId: resolveNodeId(ObjectIds.RootFolder),
        nodeClass: NodeClass.Object
    });

    const objectsFolder = addressSpace.addObject({
        browseName: "Objects",
        nodeId: resolveNodeId(ObjectIds.ObjectsFolder),
        organizedBy: rootFolder
    });

    rootFolder.objects.browseName.toString().should.eql("Objects");

    const dataTypeFolder = addressSpace.addObject({
        browseName: "DataType",
        nodeId: resolveNodeId(ObjectIds.DataTypesFolder),
        organizedBy: rootFolder
    });
    const doubleDataType = addressSpace._createNode({
        browseName: "Double",
        nodeId: resolveNodeId(DataTypeIds.Double),
        organisedBy: dataTypeFolder,
        nodeClass: NodeClass.DataType
    });


};


