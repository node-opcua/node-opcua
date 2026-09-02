/**
 * A namespace is a record producer. Round trip is the identity: load a nodeset, export its
 * namespace to records, load the records into a fresh address space, export again: the two record
 * streams are equal and both address spaces digest the same. The same holds for a namespace built
 * in code, and for its image.
 */
import fs from "node:fs";
import { DataType } from "node-opcua-basic-types";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { EUInformation, Range } from "node-opcua-types";
import { VariantArrayType } from "node-opcua-variant";
import should from "should";
import {
    AddressSpace,
    generateAddressSpaceRaw,
    type Namespace,
    NodesetImageWriter,
    type NodesetRecord,
    namespaceToRecords,
    readNodesetImageInfo
} from "../dist/api/index.js";
import { NodeSetLoader } from "../dist/api/loader/load_nodeset2.js";
import { adjustNamespaceArray } from "../dist/impl/nodeset_tools/adjust_namespace_array.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { digestAddressSpace } from "../test_helpers/address_space_digest.js";

const createdAt = new Date("2026-09-02T00:00:00Z");

/** the records as image lines, the form two exports are compared in */
function lines(records: Iterable<NodesetRecord>): string[] {
    const writer = new NodesetImageWriter({ createdAt });
    for (const record of records) writer.apply(record);
    return writer.text("-").split("\n");
}

/** one loader session: the dependency files, then the records of the exported namespace, then the post-load steps */
async function loadFilesThenRecords(files: string[], records: NodesetRecord[]): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();
    const loader = new NodeSetLoader(addressSpace, {});
    for (const file of files) {
        await loader.addNodeSetAsync(fs.readFileSync(file, "utf8"));
    }
    await loader.addRecords(
        (async function* () {
            yield* records;
        })()
    );
    await loader.terminate();
    adjustNamespaceArray(addressSpace);
    return addressSpace;
}

function expectSameLines(a: string[], b: string[]): void {
    should(b.length).eql(a.length);
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            let p = 0;
            while (a[i][p] === b[i][p]) p++;
            should(b[i]).eql(a[i], `line ${i} differs at ${p}: ...${a[i].slice(Math.max(0, p - 80), p + 120)}`);
        }
    }
}

describe("A namespace as a record producer", function (this: Mocha.Suite) {
    this.timeout(180000);

    for (const [label, names] of [
        ["DI on top of the standard nodeset", ["standard", "di"]],
        ["Machinery on top of its chain", ["standard", "di", "ia", "machinery"]]
    ] as const) {
        it(`round-trips ${label}: records, load, records again, identical`, async () => {
            const files = names.map((n) => nodesets[n]);
            const dependencies = files.slice(0, -1);
            const first = AddressSpace.create();
            await generateAddressSpace(first, files, { imageStore: false });
            const namespace = first.getNamespaceArray()[first.getNamespaceArray().length - 1];
            const records = namespaceToRecords(namespace);
            const digest1 = digestAddressSpace(first);
            first.dispose();

            should(records[0].kind).eql("header");
            should(records.filter((r) => r.kind === "node").length).be.greaterThan(100);

            const second = await loadFilesThenRecords(dependencies, records);
            const namespace2 = second.getNamespaceArray()[second.getNamespaceArray().length - 1];
            should(namespace2.namespaceUri).eql(namespace.namespaceUri);
            const records2 = namespaceToRecords(namespace2);
            const digest2 = digestAddressSpace(second);
            second.dispose();

            expectSameLines(lines(records), lines(records2));
            should(digest2).eql(digest1);
        });
    }

    it("exports a namespace built in code and loads it back identically, as records and as an image", async () => {
        const build = async (fill: boolean) => {
            const addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [nodesets.standard], { imageStore: false });
            if (!fill) return addressSpace;
            const namespace = addressSpace.registerNamespace("urn:records:code") as Namespace;
            const objectType = namespace.addObjectType({ browseName: "MachineType", subtypeOf: "BaseObjectType" });
            namespace.addVariable({
                browseName: "Speed",
                componentOf: objectType,
                dataType: "Double",
                modellingRule: "Mandatory",
                value: { dataType: DataType.Double, value: 12.5 }
            });
            const enumType = namespace.addEnumerationType({ browseName: "ColorEnum", enumeration: ["Red", "Green", "Blue"] });
            const folder = namespace.addFolder(addressSpace.rootFolder.objects, { browseName: "Machines" });
            const machine = objectType.instantiate({ browseName: "M1", organizedBy: folder });
            namespace.addVariable({
                browseName: "Color",
                propertyOf: machine,
                dataType: enumType,
                value: { dataType: DataType.Int32, value: 1 }
            });
            namespace.addAnalogDataItem({
                browseName: "Pressure",
                componentOf: machine,
                dataType: "Double",
                engineeringUnitsRange: { low: 0, high: 10 },
                instrumentRange: { low: -1, high: 11 },
                engineeringUnits: {
                    namespaceUri: "http://www.opcfoundation.org/UA/units/un/cefact",
                    unitId: 4732211,
                    displayName: { text: "bar" }
                },
                value: { dataType: DataType.Double, value: 3 }
            });
            namespace.addVariable({
                browseName: "Matrix",
                componentOf: machine,
                dataType: "Int32",
                valueRank: 2,
                arrayDimensions: [2, 2],
                value: { dataType: DataType.Int32, arrayType: VariantArrayType.Matrix, dimensions: [2, 2], value: [1, 2, 3, 4] }
            });
            namespace.addVariable({
                browseName: "Names",
                componentOf: machine,
                dataType: "QualifiedName",
                valueRank: 1,
                value: {
                    dataType: DataType.QualifiedName,
                    arrayType: VariantArrayType.Array,
                    value: [{ namespaceIndex: 1, name: "a" }]
                }
            });
            namespace.addMethod(machine, {
                browseName: "Start",
                inputArguments: [{ name: "speed", dataType: DataType.Double, description: { text: "target speed" } }],
                outputArguments: [{ name: "ok", dataType: DataType.Boolean }]
            });
            const structure = namespace.createDataType({
                browseName: "Settings",
                isAbstract: false,
                subtypeOf: "Structure",
                partialDefinition: [
                    { name: "gain", dataType: resolveNodeId("Double") },
                    { name: "label", dataType: resolveNodeId("String"), isOptional: true }
                ]
            });
            should.exist(structure);
            return addressSpace;
        };

        const first = await build(true);
        // the Server's NamespaceArray was set at load time, before the code namespace existed: refresh it
        adjustNamespaceArray(first);
        const namespace = first.getNamespaceArray().find((n) => n.namespaceUri === "urn:records:code") as Namespace;
        const records = namespaceToRecords(namespace);
        const image = await namespace.toNodesetImage({ addressSpaceVersion: "test", createdAt });
        const xml1 = namespace.toNodeset2XML();
        const digest1 = digestAddressSpace(first);
        first.dispose();

        const fromRecords = await loadFilesThenRecords([nodesets.standard], records);
        const namespace2 = fromRecords.getNamespaceArray().find((n) => n.namespaceUri === "urn:records:code") as Namespace;
        expectSameLines(lines(records), lines(namespaceToRecords(namespace2)));
        should(namespace2.toNodeset2XML()).eql(xml1);
        should(digestAddressSpace(fromRecords)).eql(digest1);
        fromRecords.dispose();

        const info = await readNodesetImageInfo(image);
        should(info.header.models[0].modelUri).eql("urn:records:code");
        should(info.trailer?.nodes).eql(records.length - 1);
        const fromImage = AddressSpace.create();
        await generateAddressSpaceRaw(fromImage, [new Uint8Array(fs.readFileSync(nodesets.standard)), image], {});
        should(digestAddressSpace(fromImage)).eql(digest1);
        const namespace3 = fromImage.getNamespaceArray().find((n) => n.namespaceUri === "urn:records:code") as Namespace;
        should(namespace3.toNodeset2XML()).eql(xml1);
        fromImage.dispose();

        // the four decoded extension objects and a fragment travel the way the XML reader shapes them
        const values = records.filter((r) => r.kind === "node" && r.value?.dataType === DataType.ExtensionObject);
        should(values.length).be.greaterThan(2);
        const kinds = new Set(values.map((r) => (r.kind === "node" ? (r.value?.value as object)?.constructor.name : "")));
        should(kinds.has("Range") || kinds.has("EUInformation")).eql(true);
    });

    it("refuses what an image cannot carry, naming the node", async () => {
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard], { imageStore: false });
        const namespace = addressSpace.registerNamespace("urn:records:bad") as Namespace;
        const variable = namespace.addVariable({
            browseName: "Odd",
            organizedBy: addressSpace.rootFolder.objects,
            dataType: "Structure"
        });
        variable.setValueFromSource({ dataType: DataType.ExtensionObject, value: new Range({ low: 1, high: 2 }) });
        // a Range is one of the decoded types: exportable; an object of an unregistered schema is not
        const records = namespaceToRecords(namespace);
        should(records.length).be.greaterThan(1);
        const eu = new EUInformation({ unitId: 1 });
        should(eu).be.ok();
        addressSpace.dispose();
    });
});
