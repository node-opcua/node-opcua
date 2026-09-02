/**
 * The XML reader is a record producer: a header first, then one record per node, ids in the
 * file's own namespace table with aliases resolved, undecodable extension objects left as XML
 * fragments in the value. The loader applies those records; nothing in them refers to an
 * address space.
 */
import { DataType } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import should from "should";
import {
    makeXmlNodesetRecordReader,
    type NodesetHeaderRecord,
    type NodesetNodeRecord,
    type NodesetRecord,
    recordBytes,
    XmlExtensionObjectFragment,
    xmlNodesetRecords
} from "../dist/api/index.js";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris>
    <Uri>urn:records:test</Uri>
    <Uri>urn:records:other</Uri>
  </NamespaceUris>
  <Models>
    <Model ModelUri="urn:records:test" Version="1.2.3" PublicationDate="2024-01-02T00:00:00Z">
      <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.03" PublicationDate="2023-12-15T00:00:00Z"/>
    </Model>
  </Models>
  <Aliases>
    <Alias Alias="HasComponent">i=47</Alias>
    <Alias Alias="Double">i=11</Alias>
    <Alias Alias="MyType">ns=1;i=1000</Alias>
  </Aliases>
  <UAObjectType NodeId="ns=1;i=1000" BrowseName="1:MyType" ReleaseStatus="Draft">
    <DisplayName>MyType</DisplayName>
    <References>
      <Reference ReferenceType="HasSubtype" IsForward="false">i=58</Reference>
    </References>
  </UAObjectType>
  <UAVariable NodeId="ns=1;i=2000" BrowseName="2:Speed" ParentNodeId="ns=1;i=1000" DataType="Double" AccessLevel="3" HasNoPermissions="true">
    <DisplayName>Speed</DisplayName>
    <References>
      <Reference ReferenceType="HasComponent" IsForward="false">MyType</Reference>
    </References>
    <Value><Double>4.5</Double></Value>
  </UAVariable>
  <UAVariable NodeId="ns=1;i=2001" BrowseName="1:Ids" DataType="NodeId" ValueRank="1">
    <Value><ListOfNodeId xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"><NodeId><Identifier>ns=2;i=7</Identifier></NodeId><NodeId><Identifier>ns=1;i=1000</Identifier></NodeId></ListOfNodeId></Value>
  </UAVariable>
  <UAVariable NodeId="ns=1;i=2002" BrowseName="1:Custom" DataType="ns=1;i=3000">
    <Value>
      <ExtensionObject xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
        <TypeId><Identifier>ns=1;i=3001</Identifier></TypeId>
        <Body><MyStruct xmlns="urn:records:test"><A>1</A><B>two</B></MyStruct></Body>
      </ExtensionObject>
    </Value>
  </UAVariable>
  <UAMethod NodeId="ns=1;i=4000" BrowseName="1:Go" ParentNodeId="ns=1;i=1000" MethodDeclarationId="ns=1;i=4001">
    <DisplayName>Go</DisplayName>
    <RolePermissions>
      <RolePermission Permissions="7">i=15644</RolePermission>
    </RolePermissions>
  </UAMethod>
</UANodeSet>`;

async function collect(chunkSize: number): Promise<NodesetRecord[]> {
    async function* chunks() {
        for (let i = 0; i < xml.length; i += chunkSize) {
            yield xml.slice(i, i + chunkSize);
        }
    }
    const out: NodesetRecord[] = [];
    for await (const record of xmlNodesetRecords(chunks())) {
        out.push(record);
    }
    return out;
}

describe("The XML reader as a record producer", () => {
    let records: NodesetRecord[];
    let header: NodesetHeaderRecord;
    let nodes: NodesetNodeRecord[];
    before(async () => {
        records = await collect(xml.length);
        header = records[0] as NodesetHeaderRecord;
        nodes = records.slice(1) as NodesetNodeRecord[];
    });

    it("emits the header first, with the file's namespace table, models and resolved aliases", () => {
        should(header.kind).eql("header");
        should(header.namespaceUris).eql(["urn:records:test", "urn:records:other"]);
        should(header.models.length).eql(1);
        should(header.models[0].modelUri).eql("urn:records:test");
        should(header.models[0].requiredModels[0].modelUri).eql("http://opcfoundation.org/UA/");
        should(header.aliases.HasComponent.toString()).eql("ns=0;i=47");
        should(header.aliases.MyType.toString()).eql("ns=1;i=1000");
    });

    it("emits one record per node, in document order, ids in the file's own table", () => {
        should(nodes.map((n) => n.nodeClass)).eql([
            NodeClass.ObjectType,
            NodeClass.Variable,
            NodeClass.Variable,
            NodeClass.Variable,
            NodeClass.Method
        ]);
        const speed = nodes[1];
        should(speed.nodeId.toString()).eql("ns=1;i=2000");
        should(speed.browseName.namespaceIndex).eql(2);
        should(speed.browseName.name).eql("Speed");
        should(speed.parentNodeId?.toString()).eql("ns=1;i=1000");
        should(speed.accessLevel).eql("3");
        should(speed.hasNoPermissions).eql(true);
    });

    it("resolves aliases in references, data types and values; no record names an alias", () => {
        const speed = nodes[1];
        should(speed.dataType?.toString()).eql("ns=0;i=11");
        should(speed.references[0].referenceType.toString()).eql("ns=0;i=47");
        should(speed.references[0].nodeId.toString()).eql("ns=1;i=1000");
        should(speed.references[0].isForward).eql(false);
        const ids = nodes[2];
        should(ids.value?.dataType).eql(DataType.NodeId);
        should(((ids.value?.value ?? []) as NodeId[]).map((n) => n.toString())).eql(["ns=2;i=7", "ns=1;i=1000"]);
    });

    it("keeps the release status and the declared permissions, whatever the loader options", () => {
        should(nodes[0].releaseStatus).eql("Draft");
        const go = nodes[4];
        should(go.methodDeclarationId?.toString()).eql("ns=1;i=4001");
        should(go.rolePermissions).eql([{ roleId: new NodeId(NodeId.NodeIdType.NUMERIC, 15644, 0), permissions: 7 }]);
    });

    it("leaves an extension object it cannot decode as an XML fragment in the value", () => {
        const custom = nodes[3];
        should(custom.value?.dataType).eql(DataType.ExtensionObject);
        const fragment = custom.value?.value;
        should(fragment).be.instanceOf(XmlExtensionObjectFragment);
        should((fragment as XmlExtensionObjectFragment).typeId.toString()).eql("ns=1;i=3001");
        should((fragment as XmlExtensionObjectFragment).bodyXML).match(/<A>1<\/A>/);
    });

    it("produces the same records from any chunking, and stamps the bytes consumed on them", async () => {
        const whole = records.map((r) => JSON.stringify(r));
        for (const size of [7, 100, 1000]) {
            const chunked = await collect(size);
            should(chunked.map((r) => JSON.stringify(r))).eql(whole, `chunk size ${size}`);
            // every byte up to the end of the chunk that completed the last record is accounted for;
            // what follows the last node (the closing tag) has no record left to carry it
            const lastRecordEnd = xml.lastIndexOf("</UAMethod>") + "</UAMethod>".length;
            const bytes = chunked.reduce((sum, r) => sum + ((r as { [recordBytes]?: number })[recordBytes] ?? 0), 0);
            should(bytes).eql(Math.min(xml.length, Math.ceil(lastRecordEnd / size) * size), `chunk size ${size}`);
        }
    });

    it("also works as a push reader: write() and end() return the records each piece completed", () => {
        const reader = makeXmlNodesetRecordReader();
        const first = reader.write(xml.slice(0, 1200));
        const rest = [...reader.write(xml.slice(1200)), ...reader.end()];
        should(first.length + rest.length).eql(records.length);
        should(first[0].kind).eql("header");
    });
});
