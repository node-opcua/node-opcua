import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, generateAddressSpaceRaw, type UAMethod, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace, readNodeSet2XmlFile } from "../nodeJS.js";

const NAMESPACE_URI = "http://sterfive.com/UA/MethodDescription/";
const IN_MEMORY = "<in-memory>";

const nodeset = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd"
           xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris>
    <Uri>${NAMESPACE_URI}</Uri>
  </NamespaceUris>
  <Models>
    <Model ModelUri="${NAMESPACE_URI}" Version="1.0.0" PublicationDate="2024-01-01T00:00:00Z">
      <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.04" PublicationDate="2020-07-15T00:00:00Z"/>
    </Model>
  </Models>
  <Aliases>
    <Alias Alias="HasModellingRule">i=37</Alias>
    <Alias Alias="HasComponent">i=47</Alias>
    <Alias Alias="HasSubtype">i=45</Alias>
  </Aliases>
  <UAObjectType NodeId="ns=1;i=1000" BrowseName="1:MachineType">
    <DisplayName>MachineType</DisplayName>
    <Description Locale="en">A machine that can be started</Description>
    <References>
      <Reference ReferenceType="HasSubtype" IsForward="false">i=58</Reference>
      <Reference ReferenceType="HasComponent">ns=1;i=1001</Reference>
      <Reference ReferenceType="HasComponent">ns=1;i=1002</Reference>
    </References>
  </UAObjectType>
  <UAMethod NodeId="ns=1;i=1001" BrowseName="1:Start" ParentNodeId="ns=1;i=1000">
    <DisplayName>Start</DisplayName>
    <Description Locale="en">Starts the machine</Description>
    <References>
      <Reference ReferenceType="HasModellingRule">i=78</Reference>
      <Reference ReferenceType="HasComponent" IsForward="false">ns=1;i=1000</Reference>
    </References>
  </UAMethod>
  <UAMethod NodeId="ns=1;i=1002" BrowseName="1:Stop" ParentNodeId="ns=1;i=1000">
    <DisplayName>Stop</DisplayName>
    <Description Locale="en">Stops the machine&apos;s drive &amp; brake &lt;now&gt;</Description>
    <References>
      <Reference ReferenceType="HasModellingRule">i=78</Reference>
      <Reference ReferenceType="HasComponent" IsForward="false">ns=1;i=1000</Reference>
    </References>
  </UAMethod>
</UANodeSet>`;

async function load(addressSpace: AddressSpace, xml: string): Promise<void> {
    await generateAddressSpaceRaw(
        addressSpace,
        [nodesets.standard, IN_MEMORY],
        async (xmlFile: string) => (xmlFile === IN_MEMORY ? xml : await readNodeSet2XmlFile(xmlFile)),
        {}
    );
}

describe("Testing loadNodeSet - UAMethod Description", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        await load(addressSpace, nodeset);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("LNSMD-1 should load the Description of a UAMethod", () => {
        const method = addressSpace.findNode("ns=1;i=1001") as UAMethod;
        should.exist(method);
        should(method.description?.text).eql("Starts the machine");
    });

    it("LNSMD-2 should give a UAMethod Description the same locale handling as other node classes", () => {
        const objectType = addressSpace.findNode("ns=1;i=1000") as UAObjectType;
        const method = addressSpace.findNode("ns=1;i=1001") as UAMethod;
        should(objectType.description?.text).eql("A machine that can be started");
        should(method.description?.locale).eql(objectType.description?.locale);
    });

    it("LNSMD-3 should decode XML entities in a UAMethod Description", () => {
        const method = addressSpace.findNode("ns=1;i=1002") as UAMethod;
        should(method.description?.text).eql("Stops the machine's drive & brake <now>");
    });

    it("LNSMD-4 should write the UAMethod Description back and read it again", async () => {
        const xml = addressSpace.getNamespace(NAMESPACE_URI).toNodeset2XML();
        should(xml).match(/<Description>Starts the machine<\/Description>/);
        should(xml).match(/<Description>Stops the machine(&apos;|')s drive &amp; brake &lt;now&gt;<\/Description>/);

        const reloaded = AddressSpace.create();
        try {
            await load(reloaded, xml);
            should((reloaded.findNode("ns=1;i=1001") as UAMethod).description?.text).eql("Starts the machine");
            should((reloaded.findNode("ns=1;i=1002") as UAMethod).description?.text).eql("Stops the machine's drive & brake <now>");
        } finally {
            reloaded.dispose();
        }
    });

    it("LNSMD-5 should keep the UAMethod Description of a catalog nodeset replayed from its image", async () => {
        // generateAddressSpace replays the committed .ndjson.gz next to the XML: an image built
        // before the fix lacks the Description even though the XML has it
        const catalog = AddressSpace.create();
        try {
            await generateAddressSpace(catalog, [nodesets.standard, nodesets.di, nodesets.ia]);
            const ns = catalog.getNamespaceIndex("http://opcfoundation.org/UA/IA/");
            const method = catalog.findNode(`ns=${ns};i=7001`) as UAMethod;
            should(method.browseName.name).eql("ResetStatistics");
            should(method.description?.text).eql(
                "Restarts all statistical data, including a reset of the StartTime to the current time."
            );
        } finally {
            catalog.dispose();
        }
    });
});
