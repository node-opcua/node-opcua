import fs from "node:fs";
import path from "node:path";
import { AccessLevelFlag, makeAccessLevelFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, generateAddressSpaceRaw, type Namespace, type UAVariable, type UAVariableType } from "..";
import { generateAddressSpace, readNodeSet2XmlFile } from "../nodeJS";

// see https://github.com/node-opcua/node-opcua/issues/1552
//
// UserAccessLevel must survive a round trip through a NodeSet2 file:
//  - the loader must read it when present, and fall back on AccessLevel when absent
//  - the exporter must write it, but only when it differs from AccessLevel
//  - it must never appear on a UAVariableType: UANodeSet.xsd does not allow it there

interface ParsedElement {
    attributes: Record<string, string>;
}

function parseElements(xml: string, elementName: string): ParsedElement[] {
    const elements: ParsedElement[] = [];
    const elementRegExp = new RegExp(`<(${elementName})((?:\\s+[^>]*?)?)\\s*/?>`, "g");
    for (const match of xml.matchAll(elementRegExp)) {
        const attributes: Record<string, string> = {};
        for (const attributeMatch of match[2].matchAll(/([\w:]+)="([^"]*)"/g)) {
            attributes[attributeMatch[1]] = attributeMatch[2];
        }
        elements.push({ attributes });
    }
    return elements;
}

function findElementByNodeId(xml: string, elementName: string, nodeId: string): ParsedElement {
    const element = parseElements(xml, elementName).find((e) => e.attributes.NodeId === nodeId);
    should.exist(element, `cannot find <${elementName} NodeId="${nodeId}"> in \n${xml}`);
    return element!;
}

const IN_MEMORY = "<in-memory>";

async function reload(xml: string): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();
    await generateAddressSpaceRaw(
        addressSpace,
        [nodesets.standard, IN_MEMORY],
        async (xmlFile: string) => (xmlFile === IN_MEMORY ? xml : await readNodeSet2XmlFile(xmlFile)),
        {}
    );
    return addressSpace;
}

describe("issue #1552 - UserAccessLevel through a NodeSet2 round trip", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        namespace = addressSpace.registerNamespace("http://sterfive.com/UA/UserAccessLevel/");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const addVariable = (browseName: string, accessLevel: string, userAccessLevel?: string): UAVariable =>
        namespace.addVariable({
            browseName,
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects,
            accessLevel,
            userAccessLevel
        });

    it("UAL-1 should write UserAccessLevel when it restricts AccessLevel", () => {
        const variable = addVariable("Restricted", "CurrentRead | CurrentWrite", "CurrentRead");
        variable.userAccessLevel!.should.eql(AccessLevelFlag.CurrentRead);

        const xml = namespace.toNodeset2XML();
        const element = findElementByNodeId(xml, "UAVariable", variable.nodeId.toString());
        element.attributes.should.have.property("AccessLevel", "3");
        element.attributes.should.have.property("UserAccessLevel", "1");
    });

    it("UAL-2 should not write UserAccessLevel when it equals AccessLevel", () => {
        const variable = addVariable("Plain", "CurrentRead | CurrentWrite");
        // a node built without a userAccessLevel leaves it undefined, which reads back as
        // "whatever accessLevel allows" - the exporter must treat that as "nothing to say"
        should(variable.userAccessLevel).eql(undefined);

        const xml = namespace.toNodeset2XML();
        const element = findElementByNodeId(xml, "UAVariable", variable.nodeId.toString());
        element.attributes.should.have.property("AccessLevel", "3");
        element.attributes.should.not.have.property("UserAccessLevel");
    });

    it("UAL-3 should never write UserAccessLevel on a UAVariableType", () => {
        // UANodeSet.xsd allows only DataType / ValueRank / ArrayDimensions on UAVariableType.
        // A guard based on the presence of a property - the way the neighbouring AccessLevel
        // one works - would emit an attribute the schema rejects.
        const variableType = namespace.addVariableType({
            browseName: "MyVariableType",
            dataType: DataType.Double
        }) as UAVariableType;
        addVariable("Restricted", "CurrentRead | CurrentWrite", "CurrentRead");

        const xml = namespace.toNodeset2XML();

        const typeElement = findElementByNodeId(xml, "UAVariableType", variableType.nodeId.toString());
        typeElement.attributes.should.not.have.property("UserAccessLevel");
        typeElement.attributes.should.not.have.property("AccessLevel");

        // and check the whole document against the schema, not just this one node
        const xsdFilename = path.join(path.dirname(nodesets.standard), "UANodeSet.xsd");
        const xsd = fs.readFileSync(xsdFilename, "utf-8");
        const allowedOnVariableType = xsd
            .slice(xsd.indexOf('<xs:complexType name="UAVariableType">'))
            .slice(0, xsd.slice(xsd.indexOf('<xs:complexType name="UAVariableType">')).indexOf("</xs:complexType>"));
        allowedOnVariableType.should.not.match(/UserAccessLevel/);
    });

    it("UAL-4 should read UserAccessLevel back, and keep it after a second round trip", async () => {
        const restricted = addVariable("Restricted", "CurrentRead | CurrentWrite", "CurrentRead");
        const plain = addVariable("Plain", "CurrentRead | CurrentWrite");
        const restrictedNodeId = restricted.nodeId.toString();
        const plainNodeId = plain.nodeId.toString();

        const xml = namespace.toNodeset2XML();

        const reloaded = await reload(xml);
        try {
            const reloadedRestricted = reloaded.findNode(restrictedNodeId) as UAVariable;
            reloadedRestricted.accessLevel.should.eql(makeAccessLevelFlag("CurrentRead | CurrentWrite"));
            reloadedRestricted.userAccessLevel!.should.eql(AccessLevelFlag.CurrentRead);

            const reloadedPlain = reloaded.findNode(plainNodeId) as UAVariable;
            reloadedPlain.userAccessLevel!.should.eql(makeAccessLevelFlag("CurrentRead | CurrentWrite"));

            // a second dump must be identical: the value is now stable, not decaying
            const xml2 = reloaded.getNamespace("http://sterfive.com/UA/UserAccessLevel/").toNodeset2XML();
            findElementByNodeId(xml2, "UAVariable", restrictedNodeId).attributes.should.have.property("UserAccessLevel", "1");
            findElementByNodeId(xml2, "UAVariable", plainNodeId).attributes.should.not.have.property("UserAccessLevel");
        } finally {
            reloaded.dispose();
        }
    });

    it("UAL-5 should not let UserAccessLevel grant more than AccessLevel", () => {
        // Part 3: UserAccessLevel can only restrict AccessLevel, never widen it
        const variable = addVariable("Widened", "CurrentRead", "CurrentRead | CurrentWrite");
        variable.userAccessLevel!.should.eql(AccessLevelFlag.CurrentRead);
    });
});
