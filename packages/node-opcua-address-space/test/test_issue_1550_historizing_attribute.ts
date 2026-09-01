import fs from "node:fs";
import path from "node:path";
import should from "should";
import "should";

import { getTempFilename } from "node-opcua-debug/nodeJS";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import { AddressSpace, type Namespace, type UAVariable, type UAVariableType } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { getMiniAddressSpace } from "../testHelpers.js";

// see https://github.com/node-opcua/node-opcua/issues/1550
//
// the Historizing attribute of a UAVariable must survive a round trip through a NodeSet2 file:
//  - it must be written by the exporter (but only when true, and never on a UAVariableType)
//  - it must be read back by the loader

// ----------------------------------------------------------------------------------------------
// tiny XML helpers : we only need to look at the attributes of the top level UAxxx elements
// ----------------------------------------------------------------------------------------------
interface ParsedElement {
    elementName: string;
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
        elements.push({ elementName: match[1], attributes });
    }
    return elements;
}

function findElementByNodeId(xml: string, elementName: string, nodeId: string): ParsedElement {
    const element = parseElements(xml, elementName).find((e) => e.attributes.NodeId === nodeId);
    should.exist(element, `cannot find <${elementName} NodeId="${nodeId}"> in \n${xml}`);
    return element!;
}

/**
 * collect the attributes that UANodeSet.xsd allows on a given complexType,
 * following the xs:extension chain ( UAVariable -> UAInstance -> UANode )
 */
function xsdAttributesOf(xsd: string, complexTypeName: string): Set<string> {
    // named complexTypes are top level : splitting on the *named* declarations gives the
    // full body of the type, including the anonymous inner complexTypes it may contain.
    const startTag = `<xs:complexType name="${complexTypeName}">`;
    const start = xsd.indexOf(startTag);
    if (start < 0) {
        throw new Error(`cannot find complexType ${complexTypeName} in UANodeSet.xsd`);
    }
    const next = xsd.indexOf(`<xs:complexType name="`, start + startTag.length);
    const body = xsd.slice(start, next < 0 ? xsd.length : next);

    const attributes = new Set<string>();
    for (const match of body.matchAll(/<xs:attribute\s+name="([^"]+)"/g)) {
        attributes.add(match[1]);
    }
    const base = /<xs:extension\s+base="([^"]+)"/.exec(body);
    if (base) {
        for (const inherited of xsdAttributesOf(xsd, base[1])) {
            attributes.add(inherited);
        }
    }
    return attributes;
}

describe("issue #1550 - Historizing attribute of a UAVariable in NodeSet2 files", function (this: Mocha.Suite) {
    this.timeout(Math.max(200000, this.timeout()));

    describe("exporting the Historizing attribute", () => {
        let addressSpace: AddressSpace;
        let namespace: Namespace;

        beforeEach(async () => {
            addressSpace = await getMiniAddressSpace();
            namespace = addressSpace.getOwnNamespace();
        });
        afterEach(() => {
            addressSpace.dispose();
        });

        function addVariable(browseName: string, historizing: boolean): UAVariable {
            return namespace.addVariable({
                browseName,
                dataType: DataType.Double,
                organizedBy: addressSpace.rootFolder.objects,
                historizing
            });
        }

        it('HIST-AC1 should write Historizing="true" for a historizing UAVariable', () => {
            const variable = addVariable("HistorizingVariable", true);
            variable.historizing.should.eql(true);

            const xml = namespace.toNodeset2XML();

            const element = findElementByNodeId(xml, "UAVariable", variable.nodeId.toString());
            element.attributes.should.have.property("Historizing", "true");
        });

        it("HIST-AC2 should not write the Historizing attribute when the variable is not historizing", () => {
            const variable = addVariable("PlainVariable", false);
            variable.historizing.should.eql(false);

            const xml = namespace.toNodeset2XML();

            const element = findElementByNodeId(xml, "UAVariable", variable.nodeId.toString());
            element.attributes.should.not.have.property("Historizing");
            // false is the XSD default: the attribute must not appear anywhere in the document
            xml.should.not.match(/Historizing/);
        });

        it("HIST-AC3 should never write the Historizing attribute on a UAVariableType", () => {
            const variableType = namespace.addVariableType({
                browseName: "MyVariableType",
                dataType: DataType.Double
            }) as UAVariableType;

            // the trap: UAVariableTypeImpl owns a `historizing` property, so a guard based on the
            // presence of the property (like the neighbouring AccessLevel one) would emit an
            // attribute that UANodeSet.xsd does not allow on UAVariableType.
            Object.hasOwn(variableType, "historizing").should.eql(true);
            (variableType as unknown as { historizing: boolean }).historizing = true;

            // a historizing variable in the same namespace, to prove the dump is not simply empty
            const variable = addVariable("HistorizingVariable", true);

            const xml = namespace.toNodeset2XML();

            const typeElement = findElementByNodeId(xml, "UAVariableType", variableType.nodeId.toString());
            typeElement.attributes.should.not.have.property("Historizing");

            const variableElement = findElementByNodeId(xml, "UAVariable", variable.nodeId.toString());
            variableElement.attributes.should.have.property("Historizing", "true");
        });

        it("HIST-AC7 should produce attributes allowed by UANodeSet.xsd", () => {
            addVariable("HistorizingVariable", true);
            addVariable("PlainVariable", false);
            const variableType = namespace.addVariableType({ browseName: "MyVariableType", dataType: DataType.Double });
            // worst case: a UAVariableType whose (non standard) historizing property has been set
            (variableType as unknown as { historizing: boolean }).historizing = true;
            namespace.addVariableType({ browseName: "MyOtherVariableType", dataType: DataType.String });

            const xml = namespace.toNodeset2XML();

            const xsdFilename = path.join(path.dirname(nodesets.standard), "UANodeSet.xsd");
            fs.existsSync(xsdFilename).should.eql(true, `expecting the UANodeSet schema at ${xsdFilename}`);
            const xsd = fs.readFileSync(xsdFilename, "utf-8");

            for (const elementName of ["UAVariable", "UAVariableType"]) {
                const allowed = xsdAttributesOf(xsd, elementName);
                const elements = parseElements(xml, elementName);
                elements.length.should.be.greaterThan(0);
                for (const element of elements) {
                    for (const attributeName of Object.keys(element.attributes)) {
                        allowed
                            .has(attributeName)
                            .should.eql(
                                true,
                                `<${elementName} NodeId="${element.attributes.NodeId}"> carries an attribute ` +
                                    `"${attributeName}" that UANodeSet.xsd does not declare on ${elementName}`
                            );
                    }
                }
            }
            // Historizing is declared on UAVariable and on UAVariable only
            xsdAttributesOf(xsd, "UAVariable").has("Historizing").should.eql(true);
            xsdAttributesOf(xsd, "UAVariableType").has("Historizing").should.eql(false);
        });

        it("HIST-AC8 should not add a Historizing attribute to a namespace without historizing variables", () => {
            addVariable("PlainVariable1", false);
            addVariable("PlainVariable2", false);
            namespace.addVariableType({ browseName: "MyVariableType", dataType: DataType.Double });
            namespace.addObject({ browseName: "MyObject", organizedBy: addressSpace.rootFolder.objects });

            const xml = namespace.toNodeset2XML();
            xml.should.not.match(/Historizing/);
        });
    });

    describe("importing the Historizing attribute", () => {
        let addressSpace: AddressSpace;
        afterEach(() => {
            addressSpace.dispose();
        });

        const nodeset = (historizingAttribute: string) => `<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://sterfive.com/historizing/</Uri>
    </NamespaceUris>
    <Models>
        <Model ModelUri="http://sterfive.com/historizing/" Version="1.0.0" PublicationDate="2024-01-01T00:00:00.000Z">
            <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.02" PublicationDate="2022-11-01T00:00:00.000Z"/>
        </Model>
    </Models>
    <Aliases>
        <Alias Alias="Double">i=11</Alias>
        <Alias Alias="HasTypeDefinition">i=40</Alias>
        <Alias Alias="Organizes">i=35</Alias>
    </Aliases>
    <UAVariable NodeId="ns=1;i=1000" BrowseName="1:SomeVariable" DataType="Double"${historizingAttribute}>
        <DisplayName>SomeVariable</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
            <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
        </References>
    </UAVariable>
</UANodeSet>
`;

        async function loadVariable(historizingAttribute: string, filename: string): Promise<UAVariable> {
            const tmpFilename = getTempFilename(filename);
            fs.writeFileSync(tmpFilename, nodeset(historizingAttribute), "utf-8");

            addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [nodesets.standard, tmpFilename]);

            const variable = addressSpace.findNode("ns=1;i=1000") as UAVariable;
            should.exist(variable);
            should(variable.browseName.name).eql("SomeVariable");
            return variable;
        }

        it('HIST-AC4 should read Historizing="true"', async () => {
            const variable = await loadVariable(' Historizing="true"', "__historizing_true.xml");
            variable.historizing.should.eql(true);
        });

        it("HIST-AC5 should default to false when the Historizing attribute is absent", async () => {
            const variable = await loadVariable("", "__historizing_absent.xml");
            variable.historizing.should.eql(false);
        });

        it('HIST-AC5b should read Historizing="false"', async () => {
            const variable = await loadVariable(' Historizing="false"', "__historizing_false.xml");
            variable.historizing.should.eql(false);
        });
    });

    describe("round tripping the real Opc.Ua.AutoID.NodeSet2.xml", () => {
        // Opc.Ua.AutoID.NodeSet2.xml declares its two LocalCoordinate variables with Historizing="true"
        const localCoordinateNodeIds = ["ns=2;i=6122", "ns=2;i=6123"];

        it("HIST-AC6 should preserve Historizing across load -> dump -> load", async () => {
            // ---------------------------------------------------------------- stage 1 : load
            const addressSpace1 = AddressSpace.create();
            await generateAddressSpace(addressSpace1, [nodesets.standard, nodesets.di, nodesets.autoId]);

            const namespaceAutoId = addressSpace1.getNamespace("http://opcfoundation.org/UA/AutoID/");
            namespaceAutoId.index.should.eql(2);

            for (const nodeId of localCoordinateNodeIds) {
                const variable = addressSpace1.findNode(nodeId) as UAVariable;
                should.exist(variable, `cannot find ${nodeId}`);
                should(variable.browseName.name).eql("LocalCoordinate");
                variable.historizing.should.eql(true, `${nodeId} should be historizing after the initial load`);
            }

            // ---------------------------------------------------------------- stage 2 : dump
            const xml = namespaceAutoId.toNodeset2XML();
            for (const nodeId of localCoordinateNodeIds) {
                const element = findElementByNodeId(xml, "UAVariable", nodeId.replace("ns=2;", "ns=1;"));
                element.attributes.should.have.property("Historizing", "true");
            }
            // the UAVariableType elements must remain free of the attribute
            for (const element of parseElements(xml, "UAVariableType")) {
                element.attributes.should.not.have.property("Historizing");
            }

            const tmpFilename = getTempFilename("__generated_autoid_nodeset2.xml");
            fs.writeFileSync(tmpFilename, xml, "utf-8");
            addressSpace1.dispose();

            // ---------------------------------------------------------------- stage 3 : reload
            const addressSpace2 = AddressSpace.create();
            await generateAddressSpace(addressSpace2, [nodesets.standard, nodesets.di, tmpFilename]);

            addressSpace2.getNamespace("http://opcfoundation.org/UA/AutoID/").index.should.eql(2);
            for (const nodeId of localCoordinateNodeIds) {
                const variable = addressSpace2.findNode(nodeId) as UAVariable;
                should.exist(variable, `cannot find ${nodeId} in the reloaded address space`);
                should(variable.browseName.name).eql("LocalCoordinate");
                variable.historizing.should.eql(true, `${nodeId} should still be historizing after the round trip`);
            }
            addressSpace2.dispose();
        });
    });
});
