/**
 * The UANodeSet attribute DesignToolOnly reaches the address space and leaves it again.
 *
 * OPC 10000-100 DI marks its Configuration, Tuning, ... FunctionalGroups DesignToolOnly="true":
 * names for design tools, which nothing references. The loader dropped the attribute, so nothing
 * on the node said it, a tool could not tell such a node from an orphan, and toNodeset2XML wrote
 * the node back without it.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type NodesetNodeRecord, xmlNodesetRecords } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

const NS = "http://example.org/DesignToolOnly/";
const xml = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris><Uri>${NS}</Uri></NamespaceUris>
  <Models>
    <Model ModelUri="${NS}" Version="1.0.0" PublicationDate="2026-01-01T00:00:00Z">
      <RequiredModel ModelUri="http://opcfoundation.org/UA/" />
    </Model>
  </Models>
  <Aliases><Alias Alias="HasTypeDefinition">i=40</Alias><Alias Alias="Organizes">i=35</Alias></Aliases>
  <UAObject NodeId="ns=1;i=73" BrowseName="1:Configuration" DesignToolOnly="true">
    <DisplayName>Configuration</DisplayName>
    <References><Reference ReferenceType="HasTypeDefinition">i=61</Reference></References>
  </UAObject>
  <UAObject NodeId="ns=1;i=74" BrowseName="1:Plant">
    <DisplayName>Plant</DisplayName>
    <References>
      <Reference ReferenceType="HasTypeDefinition">i=61</Reference>
      <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
    </References>
  </UAObject>
</UANodeSet>
`;

describe("DesignToolOnly, through the address space", () => {
    let addressSpace: AddressSpace;
    let folder: string;
    before(async () => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), "design-tool-only-"));
        const file = path.join(folder, "design_tool_only.xml");
        fs.writeFileSync(file, xml);
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, file]);
    });
    after(() => {
        addressSpace.dispose();
        fs.rmSync(folder, { recursive: true, force: true });
    });

    const nodeOf = (nodeId: string) => {
        const node = addressSpace.findNode(nodeId.replace("ns=1", `ns=${addressSpace.getNamespaceIndex(NS)}`));
        if (!node) throw new Error(`${nodeId} is not in the address space`);
        return node;
    };

    it("DTO-1 the loaded node says it, and only that one", () => {
        should(nodeOf("ns=1;i=73").designToolOnly).eql(true);
        should(nodeOf("ns=1;i=74").designToolOnly).eql(undefined);
    });

    it("DTO-2 toNodeset2XML writes it back, and only on that node", async () => {
        const exported = addressSpace.getNamespace(NS).toNodeset2XML();
        should(exported).match(/<UAObject NodeId="ns=1;i=73" BrowseName="1:Configuration"[^>]* DesignToolOnly="true"/);
        should(exported).not.match(/<UAObject NodeId="ns=1;i=74"[^>]* DesignToolOnly=/);
        const records: NodesetNodeRecord[] = [];
        for await (const record of xmlNodesetRecords([exported])) {
            if (record.kind === "node") records.push(record as NodesetNodeRecord);
        }
        should(records.filter((r) => r.designToolOnly).map((r) => r.nodeId.value)).eql([73]);
    });
});
