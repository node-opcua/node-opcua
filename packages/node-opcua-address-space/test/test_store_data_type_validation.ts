import { readFileSync } from "node:fs";
import { ACCEPTED_TYPES_KNOWN, StoreAddressSpace, type StoreVariableView } from "node-opcua-address-space-store";
import { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { ServerStatusDataType } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { compactRecordConsumer } from "../dist/api/index.js";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";

describe("store data type validation: what a Variable's DataType accepts on a write", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    const variable = (id: string) => space.findNode(id) as StoreVariableView;
    const write = (v: StoreVariableView, variant: Variant) => v.writeValue(new DataValue({ value: variant }));
    const scalar = (dataType: DataType, value: unknown) => new Variant({ dataType, value });

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192 });
        const consumer = compactRecordConsumer(space);
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        should(consumer.finish().unresolved).eql(0);
        space.registerNamespace("urn:test:datatypes");
    });

    it("publishes what each DataType accepts as a mask that answers as accepts() does", async () => {
        const resolver = space.dataTypes;
        const dataTypes = {
            Double: 11,
            Int32: 6,
            Number: 26,
            Integer: 27,
            UInteger: 28,
            BaseDataType: 24,
            String: 12,
            ByteString: 15,
            ServerState: 852,
            Structure: 22,
            ServerStatusDataType: 862
        };
        resolver.publishAcceptedTypes();
        for (const [name, id] of Object.entries(dataTypes)) {
            const dataType = space.store.find(resolveNodeId(`ns=0;i=${id}`));
            const mask = space.store.nodes.acceptedTypes(dataType);
            should((mask & ACCEPTED_TYPES_KNOWN) !== 0).eql(true, `${name} published`);
            for (let builtIn = 1; builtIn <= 25; builtIn++) {
                should(((mask >>> builtIn) & 1) === 1).eql(
                    resolver.accepts(dataType, builtIn, false),
                    `${name} / ${DataType[builtIn]}`
                );
            }
        }
        // a change of the DataTypes clears what was published at once, and publishes it again right after
        const double = space.store.find(resolveNodeId("ns=0;i=11"));
        resolver.invalidate();
        should(space.store.nodes.acceptedTypes(double)).eql(0);
        await Promise.resolve();
        should((space.store.nodes.acceptedTypes(double) & ACCEPTED_TYPES_KNOWN) !== 0).eql(true);
    });

    it("takes the built-in type and refuses another", () => {
        const currentTime = variable("ns=0;i=2258"); // DateTime
        currentTime.setValueFromSource(scalar(DataType.DateTime, new Date(0)));
        should(currentTime.readValue().value.value).eql(new Date(0));
        should(() => currentTime.setValueFromSource(scalar(DataType.Double, 1))).throw(/Double value does not fit/);
        should(write(currentTime, scalar(DataType.Double, 1))).eql(StatusCodes.BadTypeMismatch.value);
        should(write(currentTime, scalar(DataType.DateTime, new Date(1)))).eql(StatusCodes.Good.value);
        should(currentTime.readValue().value.value).eql(
            new Date(1),
            "the refused write left the value alone, the accepted one landed"
        );
    });

    it("resolves a DataType through its ancestors: an enumeration is an Int32, a structure an extension object", () => {
        const state = variable("ns=0;i=2259"); // ServerState, an enumeration
        state.setValueFromSource(scalar(DataType.Int32, 0));
        should(() => state.setValueFromSource(scalar(DataType.Double, 0))).throw();
        should(write(state, scalar(DataType.UInt32, 0))).eql(StatusCodes.BadTypeMismatch.value);

        const status = variable("ns=0;i=2256"); // ServerStatusDataType, a structure
        status.setValueFromSource(scalar(DataType.ExtensionObject, new ServerStatusDataType({})));
        should(() => status.setValueFromSource(scalar(DataType.Double, 0))).throw();
        should(write(status, scalar(DataType.String, "x"))).eql(StatusCodes.BadTypeMismatch.value);
    });

    it("lets a string and a byte string stand in for one another", () => {
        const namespaceArray = variable("ns=0;i=2255"); // String[]
        namespaceArray.setValueFromSource(
            new Variant({ dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: [] })
        );
        should(
            write(namespaceArray, new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["a"] }))
        ).eql(StatusCodes.Good.value);
    });

    it("takes any subtype of an abstract number, and anything for BaseDataType", () => {
        const objects = space.findNode("ns=0;i=85") as never;
        const number = space.addVariable({ browseName: "AnyNumber", organizedBy: objects, dataType: "ns=0;i=26" });
        number.setValueFromSource(scalar(DataType.Int32, 1));
        number.setValueFromSource(scalar(DataType.Double, 1.5));
        should(write(number, scalar(DataType.Byte, 1))).eql(StatusCodes.Good.value);
        should(write(number, scalar(DataType.String, "1"))).eql(StatusCodes.BadTypeMismatch.value);
        should(() => number.setValueFromSource(scalar(DataType.Boolean, true))).throw();

        const unsigned = space.addVariable({ browseName: "Unsigned", organizedBy: objects, dataType: "ns=0;i=28" });
        should(write(unsigned, scalar(DataType.UInt16, 1))).eql(StatusCodes.Good.value);
        should(write(unsigned, scalar(DataType.Int16, 1))).eql(StatusCodes.BadTypeMismatch.value);

        const anything = space.addVariable({ browseName: "Anything", organizedBy: objects, dataType: "ns=0;i=24" });
        anything.setValueFromSource(scalar(DataType.String, "x"));
        anything.setValueFromSource(scalar(DataType.Double, 2));
        should(write(anything, scalar(DataType.Boolean, true))).eql(StatusCodes.Good.value);
    });

    it("lets the application clear a value with Null, not a client", () => {
        const currentTime = variable("ns=0;i=2258");
        currentTime.setValueFromSource(new Variant({ dataType: DataType.Null }));
        should(write(currentTime, new Variant({ dataType: DataType.Null }))).eql(StatusCodes.BadTypeMismatch.value);
    });

    it("answers the resolution once per DataType", () => {
        const resolve = () => space.dataTypes.resolve(space.store.nodes.dataType(variable("ns=0;i=2259").index));
        should(resolve()).eql(DataType.Int32);
        const t0 = process.hrtime.bigint();
        for (let i = 0; i < 100000; i++) resolve();
        const ns = Number(process.hrtime.bigint() - t0) / 100000;
        should(ns).be.below(2000, `a remembered resolution: ${ns.toFixed(0)} ns`);
    });
});
