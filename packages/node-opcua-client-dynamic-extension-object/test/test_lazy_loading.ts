import "should";
import { ExtraDataTypeManager } from "../source/extra_data_type_manager";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes, StatusCode } from "node-opcua-status-code";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { DataTypeIds, ObjectIds, VariableIds } from "node-opcua-constants";
const { StructureDefinition } = require("node-opcua-types");

enum NodeClass {
    Object = 1,
    Variable = 2,
    Method = 4,
    ObjectType = 8,
    VariableType = 16,
    ReferenceType = 32,
    DataType = 64,
    View = 128
}

interface MockNode {
    nodeId: NodeId;
    browseName: string;
    nodeClass: number;
    attributes: Map<number, any>;
    references: { referenceTypeId: NodeId, nodeId: NodeId, isForward: boolean, browseName: string, nodeClass: number }[];
}

class MockAddressSpace {
    nodes: Map<string, MockNode> = new Map();

    constructor() {
        // Essential nodes for node-opcua-pseudo-session and browseAll
        this.addNode({ nodeId: resolveNodeId(VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints), browseName: "MaxBrowseContinuationPoints", nodeClass: NodeClass.Variable });
        this.addNode({ nodeId: resolveNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse), browseName: "MaxNodesPerBrowse", nodeClass: NodeClass.Variable });
        this.addNode({ nodeId: resolveNodeId(VariableIds.Server_ServerCapabilities_ServerProfileArray), browseName: "ServerProfileArray", nodeClass: NodeClass.Variable });

        // Add DataType and Value for these nodes
        const nodes = [
            VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
            VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse,
            VariableIds.Server_ServerCapabilities_ServerProfileArray
        ];
        for (const nid of nodes) {
            const node = this.nodes.get(resolveNodeId(nid).toString())!;
            node.attributes.set(AttributeIds.DataType, resolveNodeId(DataTypeIds.UInt32));
            node.attributes.set(AttributeIds.Value, nid === VariableIds.Server_ServerCapabilities_ServerProfileArray ? [] : 0);
        }

        this.addNode({ nodeId: resolveNodeId(ObjectIds.OPCBinarySchema_TypeSystem), browseName: "OPCBinarySchema", nodeClass: NodeClass.Object });

        // Basic DataType hierarchy
        this.addNode({ nodeId: resolveNodeId(DataTypeIds.BaseDataType), browseName: "BaseDataType", nodeClass: NodeClass.DataType });
        this.addNode({ nodeId: resolveNodeId(DataTypeIds.Structure), browseName: "Structure", nodeClass: NodeClass.DataType });
        this.addNode({ nodeId: resolveNodeId(DataTypeIds.UInt32), browseName: "UInt32", nodeClass: NodeClass.DataType });

        this.addReference(resolveNodeId(DataTypeIds.BaseDataType), "HasSubtype", resolveNodeId(DataTypeIds.Structure));
        this.addReference(resolveNodeId(DataTypeIds.BaseDataType), "HasSubtype", resolveNodeId(DataTypeIds.UInt32));

        // Add basic types
        const basicTypes = [
            { id: 1, name: "Boolean" },
            { id: 6, name: "Int32" },
            { id: 11, name: "Double" },
            { id: 12, name: "String" },
            { id: 13, name: "DateTime" },
            { id: 14, name: "Guid" },
            { id: 15, name: "ByteString" },
            { id: 16, name: "XmlElement" },
            { id: 17, name: "NodeId" },
            { id: 20, name: "QualifiedName" },
            { id: 21, name: "LocalizedText" }
        ];
        for (const type of basicTypes) {
            const nid = new NodeId(NodeId.NodeIdType.NUMERIC, type.id, 0);
            this.addNode({ nodeId: nid, browseName: type.name, nodeClass: NodeClass.DataType });
            this.addReference(resolveNodeId(DataTypeIds.BaseDataType), "HasSubtype", nid);
        }
    }

    addNode(node: { nodeId: NodeId, browseName: string, nodeClass?: number }): MockNode {
        const mockNode: MockNode = {
            nodeId: node.nodeId,
            browseName: node.browseName,
            nodeClass: node.nodeClass || NodeClass.DataType,
            attributes: new Map(),
            references: []
        };
        mockNode.attributes.set(AttributeIds.BrowseName, { name: node.browseName });
        if (mockNode.nodeClass === NodeClass.DataType) {
            mockNode.attributes.set(AttributeIds.IsAbstract, false);
            const def = new StructureDefinition();
            def.baseDataType = resolveNodeId(DataTypeIds.Structure);
            mockNode.attributes.set(AttributeIds.DataTypeDefinition, def);
        }
        this.nodes.set(node.nodeId.toString(), mockNode);
        return mockNode;
    }

    addReference(source: NodeId, referenceTypeId: NodeId | string, target: NodeId, isForward: boolean = true) {
        const s = this.nodes.get(source.toString());
        const t = this.nodes.get(target.toString());
        const refId = typeof referenceTypeId === "string" ? resolveNodeId(referenceTypeId) : referenceTypeId;
        if (s && t) {
            s.references.push({ referenceTypeId: refId, nodeId: target, isForward, browseName: t.browseName, nodeClass: t.nodeClass });
            t.references.push({ referenceTypeId: refId, nodeId: source, isForward: !isForward, browseName: s.browseName, nodeClass: s.nodeClass });
        }
    }

    read(nodeId: NodeId, attributeId: AttributeIds): any {
        if (!nodeId) return { statusCode: StatusCodes.BadNodeIdInvalid, value: null };
        const key = nodeId.toString();
        let node = this.nodes.get(key);
        if (!node) {
            if (key.startsWith("i=")) {
                node = this.nodes.get("ns=0;" + key);
            } else if (!key.startsWith("ns=")) {
                node = this.nodes.get("i=" + key) || this.nodes.get("ns=0;i=" + key);
            }
        }

        if (!node) return { statusCode: StatusCodes.BadNodeIdUnknown, value: null };
        let value = node.attributes.get(attributeId);
        if (value === undefined) {
            if (attributeId === AttributeIds.BrowseName) {
                value = { name: node.browseName };
            } else if (attributeId === AttributeIds.NodeClass) {
                value = node.nodeClass;
            } else {
                return { statusCode: StatusCodes.BadAttributeIdInvalid, value: null };
            }
        }
        return { statusCode: StatusCodes.Good, value };
    }

    browse(nodeId: NodeId, options: any): any {
        if (!nodeId) return { statusCode: StatusCodes.BadNodeIdInvalid, references: [] };
        const key = nodeId.toString();
        let node = this.nodes.get(key);
        if (!node) {
            if (key.startsWith("i=")) {
                node = this.nodes.get("ns=0;" + key);
            } else if (!key.startsWith("ns=")) {
                node = this.nodes.get("i=" + key) || this.nodes.get("ns=0;i=" + key);
            }
        }

        if (!node) return { statusCode: StatusCodes.BadNodeIdUnknown, references: [] };
        const refTypeId = options.referenceTypeId ? (typeof options.referenceTypeId === "string" ? resolveNodeId(options.referenceTypeId) : options.referenceTypeId) : null;

        let filteredRefs = node.references;
        if (refTypeId) {
            filteredRefs = filteredRefs.filter(r => r.referenceTypeId.toString() === refTypeId.toString());
        }
        if (options.browseDirection === BrowseDirection.Forward) {
            filteredRefs = filteredRefs.filter(r => r.isForward);
        } else if (options.browseDirection === BrowseDirection.Inverse) {
            filteredRefs = filteredRefs.filter(r => !r.isForward);
        }

        return {
            references: filteredRefs.map(r => ({
                nodeId: r.nodeId,
                browseName: { name: r.browseName },
                referenceTypeId: r.referenceTypeId,
                isForward: r.isForward,
                nodeClass: r.nodeClass
            })),
            statusCode: StatusCodes.Good
        };
    }
}

describe("ExtraDataTypeManager Lazy Loading Robust", () => {

    const namespaceArray = ["http://opcfoundation.org/UA/", "urn:Test"];
    const testNamespaceIndex = 1;

    function createMockSession(addressSpace: MockAddressSpace) {
        const session = {
            readCount: 0,
            browseCount: 0,
            read: async (nodesToRead: any) => {
                const results = (Array.isArray(nodesToRead) ? nodesToRead : [nodesToRead]).map(n => {
                    session.readCount++;
                    const res = addressSpace.read(n.nodeId, n.attributeId);
                    const dv = {
                        statusCode: res.statusCode,
                        value: res.value !== null && res.value !== undefined ? {
                            value: res.value,
                            toString: () => "Variant(" + JSON.stringify(res.value) + ")"
                        } : undefined
                    };
                    return dv;
                });
                return Array.isArray(nodesToRead) ? results : results[0];
            },
            browse: async (nodesToBrowse: any) => {
                session.browseCount++;
                const results = (Array.isArray(nodesToBrowse) ? nodesToBrowse : [nodesToBrowse]).map(nodeToBrowse => {
                    const res = addressSpace.browse(nodeToBrowse.nodeId, nodeToBrowse);
                    return {
                        statusCode: res.statusCode,
                        references: res.references
                    };
                });
                return Array.isArray(nodesToBrowse) ? results : results[0];
            },
            translateBrowsePath: async (browsePath: any) => {
                return { statusCode: StatusCodes.BadNoMatch, targets: [] };
            }
        };
        return session;
    }

    it("should lazy load a data type when requested", async () => {
        const addressSpace = new MockAddressSpace();
        const dataTypeNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, 1000, testNamespaceIndex);
        addressSpace.addNode({ nodeId: dataTypeNodeId, browseName: "MyTestDataType", nodeClass: NodeClass.DataType });
        addressSpace.addReference(resolveNodeId(DataTypeIds.Structure), "HasSubtype", dataTypeNodeId);

        const dataTypeManager = new ExtraDataTypeManager();
        dataTypeManager.setNamespaceArray(namespaceArray);
        const testFactory = new DataTypeFactory([getStandardDataTypeFactory()]);
        dataTypeManager.registerDataTypeFactory(testNamespaceIndex, testFactory);

        const mockSession = createMockSession(addressSpace);
        dataTypeManager.setSession(mockSession as any);

        const info = await dataTypeManager.getStructureInfoForDataTypeAsync(dataTypeNodeId);
        info.schema.name.should.eql("MyTestDataType");
    });

    it("should handle multiple simultaneous requests (non-reentrancy)", async () => {
        const addressSpace = new MockAddressSpace();
        const dataTypeNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, 1000, testNamespaceIndex);
        addressSpace.addNode({ nodeId: dataTypeNodeId, browseName: "MyTestDataType", nodeClass: NodeClass.DataType });
        addressSpace.addReference(resolveNodeId(DataTypeIds.Structure), "HasSubtype", dataTypeNodeId);

        const dataTypeManager = new ExtraDataTypeManager();
        dataTypeManager.setNamespaceArray(namespaceArray);
        const testFactory = new DataTypeFactory([getStandardDataTypeFactory()]);
        dataTypeManager.registerDataTypeFactory(testNamespaceIndex, testFactory);

        const mockSession = createMockSession(addressSpace);
        dataTypeManager.setSession(mockSession as any);

        const promises = [
            dataTypeManager.getStructureInfoForDataTypeAsync(dataTypeNodeId),
            dataTypeManager.getStructureInfoForDataTypeAsync(dataTypeNodeId)
        ];
        const results = await Promise.all(promises);
        results[0].should.equal(results[1]);
    });

    it("should optimize serverImplementsDataTypeDefinition", async () => {
        const { serverImplementsDataTypeDefinition } = require("../source/populate_data_type_manager");
        const addressSpace = new MockAddressSpace();

        const structureRootId = resolveNodeId(DataTypeIds.Structure);
        const customDataTypeNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, 1111, testNamespaceIndex);
        addressSpace.addNode({ nodeId: customDataTypeNodeId, browseName: "CustomType", nodeClass: NodeClass.DataType });
        addressSpace.addReference(structureRootId, "HasSubtype", customDataTypeNodeId);

        const mockSession = createMockSession(addressSpace);
        const result = await serverImplementsDataTypeDefinition(mockSession as any);
        result.should.eql(true);
    });

    it("should lazy load via binary encoding ID", async () => {
        const addressSpace = new MockAddressSpace();
        const dataTypeNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, 1000, testNamespaceIndex);
        const binaryEncodingNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, 2000, testNamespaceIndex);

        addressSpace.addNode({ nodeId: dataTypeNodeId, browseName: "MyTestDataType", nodeClass: NodeClass.DataType });
        addressSpace.addReference(resolveNodeId(DataTypeIds.Structure), "HasSubtype", dataTypeNodeId);
        addressSpace.addNode({ nodeId: binaryEncodingNodeId, browseName: "Default Binary", nodeClass: NodeClass.Object });
        addressSpace.addReference(dataTypeNodeId, "HasEncoding", binaryEncodingNodeId, true);

        const dataTypeManager = new ExtraDataTypeManager();
        dataTypeManager.setNamespaceArray(namespaceArray);
        const testFactory = new DataTypeFactory([getStandardDataTypeFactory()]);
        dataTypeManager.registerDataTypeFactory(testNamespaceIndex, testFactory);

        const mockSession = createMockSession(addressSpace);
        dataTypeManager.setSession(mockSession as any);

        const Constructor = await dataTypeManager.getExtensionObjectConstructorFromBinaryEncodingAsync(binaryEncodingNodeId);
        Constructor.should.be.a.Function();
        Constructor.name.should.eql("MyTestDataType");
    });
});
