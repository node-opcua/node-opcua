/* global describe,it,before*/

const should = require("should");

const assert = require("node-opcua-assert").assert;

const DataType = require("node-opcua-variant").DataType;

const NodeClass = require("node-opcua-data-model").NodeClass;

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

const ObjectTypeIds = require("node-opcua-constants").ObjectTypeIds;
const VariableTypeIds = require("node-opcua-constants").VariableTypeIds;
const ReferenceTypeIds = require("node-opcua-constants").ReferenceTypeIds;
const ObjectIds = require("node-opcua-constants").ObjectIds;
const DataTypeIds = require("node-opcua-constants").DataTypeIds;


const Reference = require("..").Reference;

function dumpReferencesHierarchy(addressSpace) {

    function _dump(referenceType,level) {


        console.log(level,referenceType.browseName.toString(),"(",referenceType.getAllSubtypes().map(x=>x.browseName.toString()).join(" ").green,")");

        const subTypes = referenceType.findReferencesExAsObject("HasSubtype");
        for(let subType of subTypes) {
            _dump(subType,"     "+ level);

        }
    }
    const references= addressSpace.findNode(ReferenceTypeIds.References);

    _dump(references," ");

}
module.exports = function create_minimalist_address_space_nodeset(addressSpace) {

    resolveNodeId(ObjectTypeIds.BaseObjectType).toString().should.eql("ns=0;i=58");

    const namespace0 = addressSpace.registerNamespace("http://opcfoundation.org/UA/");
    assert(namespace0.index === 0);

    function addReferenceType(browseName,isAbstract,superType)
    {
        browseName = browseName.split("/");
        let inverseName = browseName[1];
        browseName = browseName[0];


        const options = {
            browseName: browseName,
            inverseName: inverseName,
            nodeId: resolveNodeId(ReferenceTypeIds[browseName]),
            nodeClass: NodeClass.ReferenceType,
            superType: superType,
            isAbstract: isAbstract
        };
        options.references = [];
        const hasSubType = resolveNodeId("HasSubtype");
        if (superType) {
            options.references.push({
                referenceType: hasSubType, isForward: false, nodeId: superType.nodeId
            });
        }
        const node = namespace0._createNode(options);

        node.propagate_back_references();

        return node;
    }

    // add references
    {

        // before we do any thing , we need to create the HasSubtype reference
        // which is required in the first to create the hierachy of References
        const hasSubtype = addReferenceType("HasSubtype/HasSupertype");


        const references = addReferenceType("References",true,null);
        {
            const nonHierarchicalReferences = addReferenceType("NonHierarchicalReferences",true,references);
            {
                const hasTypeDefinition = addReferenceType("HasTypeDefinition/TypeDefinitionOf",false,nonHierarchicalReferences);
            }
        }
        {
            const hierarchicalReferences =addReferenceType("HierarchicalReferences",true,references);
            {

                const hasChild = addReferenceType("HasChild/ChildOf",true,hierarchicalReferences);
                {
                    const aggregates = addReferenceType("Aggregates/AggregatedBy",true,hasChild);
                    {
                        const hasComponent = addReferenceType("HasComponent/ComponentOf",false, aggregates);
                        const hasProperty = addReferenceType("HasProperty/PropertyOf",false,aggregates);
                        const hasHistoricalConfiguration = addReferenceType("HasHistoricalConfiguration/HistoricalConfigurationOf",false,aggregates);
                    }
                }
                {
                    // add a link to hasSubType
                    hasSubtype.addReference({
                        referenceType: hasSubtype, isForward: false, nodeId: hasChild
                    });
                    }
            }
            {
                const organizes = addReferenceType("Organizes/OrganizedBy",false,hierarchicalReferences);
            }
            {
                const hasEventSource = addReferenceType("HasEventSource/EventSourceOf",false,hierarchicalReferences);
            }
        }
    }

    dumpReferencesHierarchy(addressSpace);

    const baseObjectType = namespace0._createNode({
        browseName: "BaseObjectType",
        nodeId: resolveNodeId(ObjectTypeIds.BaseObjectType),
        nodeClass: NodeClass.ObjectType,
        isAbstract: true
    });

    const baseVariableType = namespace0._createNode({
        browseName: "BaseVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseVariableType),
        nodeClass: NodeClass.VariableType,
        isAbstract: true
    });

    const propertyType = namespace0.addVariableType({
        browseName: "PropertyType",
        subtypeOf: baseVariableType,
    });

    const baseDataVariableType = namespace0._createNode({
        browseName: "BaseDataVariableType",
        nodeId: resolveNodeId(VariableTypeIds.BaseDataVariableType),
        nodeClass: NodeClass.VariableType,
        subtypeOf: baseVariableType.nodeId,
        isAbstract: true
    });

    // add the root folder
    {
        const rootFolder = namespace0._createNode({
            browseName: "RootFolder",
            nodeId: resolveNodeId(ObjectIds.RootFolder),
            nodeClass: NodeClass.Object
        });


        {
            const objectsFolder = namespace0.addObject({
                browseName: "Objects",
                nodeId: resolveNodeId(ObjectIds.ObjectsFolder),
                organizedBy: rootFolder
            });

            rootFolder.getFolderElementByName("Objects").browseName.toString().should.eql("Objects");

        }
        {
            const dataTypeFolder = namespace0.addObject({
                browseName: "DataType",
                nodeId: resolveNodeId(ObjectIds.DataTypesFolder),
                organizedBy: rootFolder
            });
            {
                const doubleDataType = namespace0._createNode({
                    browseName: "Double",
                    nodeId: resolveNodeId(DataTypeIds.Double),
                    organisedBy: dataTypeFolder,
                    nodeClass: NodeClass.DataType
                });
            }
        }
    }
};


