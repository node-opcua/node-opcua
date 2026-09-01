import util from "node:util";
import { coerceNodeId, type NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StructureDefinition } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { Xml2Json } from "node-opcua-xml2json";
import should from "should";

import { AddressSpace } from "..";
import { makeXmlExtensionObjectReader } from "../dist/api/loader/make_xml_extension_object_parser.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("test xml decode", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(async () => {
        addressSpace.dispose();
    });
    it("should xml decode", () => {
        const definition = new StructureDefinition({
            fields: [
                {
                    dataType: resolveNodeId(DataType.ByteString),
                    name: "Certificates",
                    arrayDimensions: [],
                    valueRank: 1,
                    description: "some description",
                    isOptional: true,
                    maxStringLength: 0
                },
                {
                    dataType: resolveNodeId(DataType.String),
                    name: "Url",
                    arrayDimensions: [],
                    valueRank: -1,
                    description: "some description",
                    isOptional: true,
                    maxStringLength: 0
                }
            ]
        });

        const definitionMap = {
            findDefinition(dataTypeNodeId: NodeId): { name: string; definition: StructureDefinition } {
                switch (dataTypeNodeId.toString()) {
                    case coerceNodeId("ns=1;i=1").toString(): {
                        return { name: "ConnectionDetails", definition };
                    }
                    default:
                        throw new Error(`not implemented${dataTypeNodeId.toString()}`);
                }
            }
        };
        const xmlBody = `
<ConnectionDetails xmlns="http://sterfive.com/Small_model/Types.xsd">
    <EncodingMask>1</EncodingMask>
    <Certificates>
        <ByteString xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">SGVsbG8=</ByteString>
        <ByteString xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">V29ybGQ=</ByteString>
    </Certificates>
    <Url>http://10.0.19.124</Url>
</ConnectionDetails>
`;

        const translateNodeId = (nodeId: string) => resolveNodeId(nodeId);
        const reader = makeXmlExtensionObjectReader(coerceNodeId("ns=1;i=1"), definitionMap, new Map(), translateNodeId);
        const parser2 = new Xml2Json(reader);
        const pojo = parser2.parseString(xmlBody);
        console.log(util.inspect(pojo, { colors: true, depth: 10 }));
        (pojo.certificates as Buffer[]).length.should.eql(2);
        should((pojo.certificates as Buffer[])[0]?.toString("utf-8")).eql("Hello");
        should((pojo.certificates as Buffer[])[1]?.toString("utf-8")).eql("World");
        (pojo.url as string).should.eql("http://10.0.19.124");
    });

    // see https://github.com/node-opcua/node-opcua/issues/1543
    // some companion specifications (for instance http://opcfoundation.org/UA/TMC/v2/) define
    // structures that directly or indirectly refer to themselves. The reader construction used
    // to recurse forever on those, ending with a `RangeError: Maximum call stack size exceeded`.
    it("XMLDEC-1 should xml decode a self referencing structure without blowing the stack", () => {
        // struct TreeNode { String Name; TreeNode[] Children; }
        const treeNodeDataTypeNodeId = coerceNodeId("ns=1;i=1000");
        const definition = new StructureDefinition({
            fields: [
                { dataType: resolveNodeId(DataType.String), name: "Name", valueRank: -1 },
                { dataType: treeNodeDataTypeNodeId, name: "Children", valueRank: 1 }
            ]
        });
        const definitionMap = {
            findDefinition(dataTypeNodeId: NodeId): { name: string; definition: StructureDefinition } {
                if (dataTypeNodeId.toString() === treeNodeDataTypeNodeId.toString()) {
                    return { name: "TreeNode", definition };
                }
                throw new Error(`not implemented ${dataTypeNodeId.toString()}`);
            }
        };
        // the nesting is deep enough for the readers of TreeNode and Children to be re-entered
        const xmlBody = `
<TreeNode xmlns="http://sterfive.com/Small_model/Types.xsd">
    <Name>root</Name>
    <Children>
        <TreeNode>
            <Name>child1</Name>
            <Children>
                <TreeNode>
                    <Name>grandChild1</Name>
                    <Children></Children>
                </TreeNode>
                <TreeNode>
                    <Name>grandChild2</Name>
                    <Children></Children>
                </TreeNode>
            </Children>
        </TreeNode>
        <TreeNode>
            <Name>child2</Name>
            <Children></Children>
        </TreeNode>
    </Children>
</TreeNode>
`;
        const translateNodeId = (nodeId: string) => resolveNodeId(nodeId);
        const reader = makeXmlExtensionObjectReader(treeNodeDataTypeNodeId, definitionMap, new Map(), translateNodeId);
        const parser2 = new Xml2Json(reader);
        const pojo = parser2.parseString(xmlBody);

        // note: the decoded pojo has a null prototype, hence the round trip through JSON
        JSON.parse(JSON.stringify(pojo)).should.eql({
            name: "root",
            children: [
                {
                    name: "child1",
                    children: [
                        { name: "grandChild1", children: [] },
                        { name: "grandChild2", children: [] }
                    ]
                },
                { name: "child2", children: [] }
            ]
        });
    });

    it("XMLDEC-2 should xml decode a structure reusing the same nested structure twice", () => {
        // struct Pair { Inner A; Inner B; }  struct Inner { String Value; }
        const innerDataTypeNodeId = coerceNodeId("ns=1;i=2000");
        const pairDataTypeNodeId = coerceNodeId("ns=1;i=2001");
        const innerDefinition = new StructureDefinition({
            fields: [{ dataType: resolveNodeId(DataType.String), name: "Value", valueRank: -1 }]
        });
        const pairDefinition = new StructureDefinition({
            fields: [
                { dataType: innerDataTypeNodeId, name: "A", valueRank: -1 },
                { dataType: innerDataTypeNodeId, name: "B", valueRank: -1 }
            ]
        });
        const definitionMap = {
            findDefinition(dataTypeNodeId: NodeId): { name: string; definition: StructureDefinition } {
                switch (dataTypeNodeId.toString()) {
                    case innerDataTypeNodeId.toString():
                        return { name: "Inner", definition: innerDefinition };
                    case pairDataTypeNodeId.toString():
                        return { name: "Pair", definition: pairDefinition };
                    default:
                        throw new Error(`not implemented ${dataTypeNodeId.toString()}`);
                }
            }
        };
        const xmlBody = `
<Pair xmlns="http://sterfive.com/Small_model/Types.xsd">
    <A><Value>hello</Value></A>
    <B><Value>world</Value></B>
</Pair>
`;
        const translateNodeId = (nodeId: string) => resolveNodeId(nodeId);
        const reader = makeXmlExtensionObjectReader(pairDataTypeNodeId, definitionMap, new Map(), translateNodeId);
        const parser2 = new Xml2Json(reader);
        const pojo = parser2.parseString(xmlBody);
        (pojo.a as { value: string }).value.should.eql("hello");
        (pojo.b as { value: string }).value.should.eql("world");
    });

    // the TMC nodeset of issue #1543 has a `MaterialPointType` structure with an ExpandedNodeId field,
    // a data type that had no entry at all in the `partials` table.
    it("XMLDEC-3 should xml decode a structure with an ExpandedNodeId field", () => {
        const dataTypeNodeId = coerceNodeId("ns=1;i=3000");
        const definition = new StructureDefinition({
            fields: [
                { dataType: resolveNodeId(DataType.ExpandedNodeId), name: "ConnectedMaterialPoint", valueRank: -1 },
                { dataType: resolveNodeId(DataType.ExpandedNodeId), name: "PlainOne", valueRank: -1 }
            ]
        });
        const definitionMap = {
            findDefinition(): { name: string; definition: StructureDefinition } {
                return { name: "MaterialPointType", definition };
            }
        };
        const xmlBody = `
<MaterialPointType xmlns="http://sterfive.com/Small_model/Types.xsd">
    <ConnectedMaterialPoint>
        <Identifier>svr=1;nsu=http://sterfive.com/UA/;i=42</Identifier>
    </ConnectedMaterialPoint>
    <PlainOne>
        <Identifier>ns=2;s=Boiler</Identifier>
    </PlainOne>
</MaterialPointType>
`;
        const translateNodeId = (nodeId: string) => resolveNodeId(nodeId);
        const reader = makeXmlExtensionObjectReader(dataTypeNodeId, definitionMap, new Map(), translateNodeId);
        const parser2 = new Xml2Json(reader);
        const pojo = parser2.parseString(xmlBody);

        // note: like the NodeId parser, the decoded value is a plain pojo (see _clone), which
        // constructExtensionObject then coerces back into a real ExpandedNodeId.
        JSON.parse(JSON.stringify(pojo)).should.eql({
            connectedMaterialPoint: {
                identifierType: NodeIdType.NUMERIC,
                value: 42,
                namespace: 0,
                namespaceUri: "http://sterfive.com/UA/",
                serverIndex: 1
            },
            plainOne: {
                identifierType: NodeIdType.STRING,
                value: "Boiler",
                namespace: 2,
                namespaceUri: null,
                serverIndex: 0
            }
        });
    });
});
