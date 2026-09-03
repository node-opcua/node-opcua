/**
 * The end of a load propagates the back references a document declares from one end only, for
 * every node class the applier creates, reference types included: they go through addReferenceType
 * rather than createNode, and used to be left to the whole-address-space sweep.
 */
import fs from "node:fs";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { AddressSpace, generateAddressSpaceRaw, nodesetToImage, type UAReferenceType } from "../dist/api/index.js";
import { NodesetRecordApplier } from "../dist/api/loader/nodeset_record_applier.js";
import { get_mini_nodeset_filename } from "../test_helpers/get_mini_address_space.js";

const uri = "urn:test:one-sided";
const oneSided = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris><Uri>${uri}</Uri></NamespaceUris>
  <Models><Model ModelUri="${uri}" Version="1.0.0" PublicationDate="2026-01-01T00:00:00Z"/></Models>
  <UAReferenceType NodeId="ns=1;i=1" BrowseName="1:HasParentSide">
    <DisplayName>HasParentSide</DisplayName>
    <References><Reference ReferenceType="HasSubtype" IsForward="false">i=33</Reference></References>
    <InverseName>ParentSideOf</InverseName>
  </UAReferenceType>
  <UAReferenceType NodeId="ns=1;i=2" BrowseName="1:HasChildSide">
    <DisplayName>HasChildSide</DisplayName>
    <References><Reference ReferenceType="HasSubtype" IsForward="false">ns=1;i=1</Reference></References>
    <InverseName>ChildSideOf</InverseName>
  </UAReferenceType>
</UANodeSet>`;

describe("the back references of a loaded reference type", function (this: Mocha.Suite) {
    this.timeout(60000);

    it("are propagated, from the document's one-sided declaration", async () => {
        const addressSpace = AddressSpace.create();
        const settled: string[] = [];
        const take = NodesetRecordApplier.prototype.takePendingBackReferences;
        NodesetRecordApplier.prototype.takePendingBackReferences = function (this: NodesetRecordApplier) {
            const pending = take.call(this);
            for (const node of pending.settled) settled.push(node.browseName.name || "");
            return pending;
        };
        // an image says of each reference whether the other end declares it; the XML reader does not
        const image = await nodesetToImage(oneSided);
        try {
            await generateAddressSpaceRaw(addressSpace, [fs.readFileSync(get_mini_nodeset_filename(), "utf8"), image], {});
        } finally {
            NodesetRecordApplier.prototype.takePendingBackReferences = take;
        }
        try {
            const ns = addressSpace.getNamespaceIndex(uri);
            const parent = addressSpace.findNode(`ns=${ns};i=1`) as UAReferenceType;
            const child = addressSpace.findNode(`ns=${ns};i=2`) as UAReferenceType;
            should(parent.findReferencesEx("HasSubtype").map((ref) => ref.node)).containEql(child);
            should(parent.getAllSubtypes()).containEql(child);
            should(child.isSubtypeOf(parent)).eql(true);
            // the reference types were settled by the applier, like every other node it created
            should(settled).containEql("HasParentSide");
            should(settled).containEql("HasChildSide");
        } finally {
            addressSpace.dispose();
        }
    });
});
