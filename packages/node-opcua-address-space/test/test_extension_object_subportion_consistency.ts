import "should";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import { AddressSpace, SessionContext, type UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

// Probes whether writing to a SUB-PORTION (a child / grand-child Variable) of a bound high level
// ExtensionObject keeps the parent aggregate and the JavaScript Proxy structure consistent.
//
// Invariant under test: after ANY write, at ANY level, reading the parent and reading the child
// must agree, and further writes (at either level) must keep cascading - i.e. the proxy wiring
// between the child Variables and the parent extension object is never severed.
describe("ExtensionObject - consistency when writing a sub-portion of a bound extension object", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    const context = SessionContext.defaultContext;
    const xml_file = getAddressSpaceFixture("all_terminal_value_types.xml");

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);
    });
    after(() => {
        addressSpace.dispose();
    });

    let parent: UAVariable;
    beforeEach(() => {
        const ns = addressSpace.getNamespaceIndex("http://test-terminal-values.example.com");
        parent = addressSpace.findNode(`ns=${ns};i=6000`) as UAVariable;
        parent.bindExtensionObject(undefined, { createMissingProp: true });
    });

    function child(name: string): UAVariable {
        return parent.getComponentByName(name) as UAVariable;
    }

    it("SUB-1 setValueFromSource on a terminal child keeps parent and child consistent", () => {
        const fieldInt32 = child("fieldInt32");

        fieldInt32.setValueFromSource({ dataType: DataType.Int32, value: 4242 });

        // child reflects
        fieldInt32.readValue().value.value.should.eql(4242);
        // parent aggregate reflects the same value (proxy still wired)
        parent.readValue().value.value.fieldInt32.should.eql(4242);
    });

    it("SUB-2 a whole-parent write AFTER a child write still cascades to children", () => {
        const fieldInt32 = child("fieldInt32");

        // first poke the child
        fieldInt32.setValueFromSource({ dataType: DataType.Int32, value: 111 });
        parent.readValue().value.value.fieldInt32.should.eql(111);

        // now replace the whole parent object
        const ns = addressSpace.getNamespaceIndex("http://test-terminal-values.example.com");
        const dt = addressSpace.findDataType("AllTerminalsStruct", ns)!;
        const newObj = addressSpace.constructExtensionObject(dt, { fieldInt32: 222, fieldInner: { innerInt32: 7 } });
        parent.setValueFromSource({ dataType: DataType.ExtensionObject, value: newObj });

        // child must see the whole-parent update (proxy not severed by the earlier child write)
        fieldInt32.readValue().value.value.should.eql(222);
        parent.readValue().value.value.fieldInt32.should.eql(222);
    });

    it("SUB-3 direct proxy mutation still reaches the child after a child setValueFromSource", () => {
        const fieldInt32 = child("fieldInt32");

        fieldInt32.setValueFromSource({ dataType: DataType.Int32, value: 5 });

        // mutate through the parent proxy directly, then touch
        (parent.$extensionObject as { fieldInt32: number }).fieldInt32 = 6;
        parent.touchValue();

        // if the child's binding to the proxy was broken, this would still read 5
        fieldInt32.readValue().value.value.should.eql(6);
        parent.readValue().value.value.fieldInt32.should.eql(6);
    });

    it("SUB-4a writeValue on a NESTED sub-structure child cascades to grandchildren and parent", async () => {
        const fieldInner = child("fieldInner");
        const innerInt32 = fieldInner.getComponentByName("innerInt32") as UAVariable;

        const ns = addressSpace.getNamespaceIndex("http://test-terminal-values.example.com");
        const innerDt = addressSpace.findDataType("InnerStruct", ns)!;
        const newInner = addressSpace.constructExtensionObject(innerDt, {
            innerDateTime: new Date("2030-01-01T00:00:00.000Z"),
            innerInt32: 777
        });

        const sc = await fieldInner.writeValue(
            context,
            new DataValue({ value: { dataType: DataType.ExtensionObject, value: newInner } })
        );
        sc.name.should.eql("Good");

        // grandchild reflects
        innerInt32.readValue().value.value.should.eql(777);
        // nested struct child reflects
        fieldInner.readValue().value.value.innerInt32.should.eql(777);
        // top level parent reflects
        parent.readValue().value.value.fieldInner.innerInt32.should.eql(777);
    });

    it("SUB-4b setValueFromSource on a NESTED sub-structure child cascades to grandchildren and parent", () => {
        // setValueFromSource on a bound sub-structure child now behaves like writeValue (SUB-4a):
        // it routes through the overridden _inner_replace_dataValue / field setter instead of
        // assigning the frozen $dataValue, keeping the proxy structure consistent.
        const fieldInner = child("fieldInner");
        const innerInt32 = fieldInner.getComponentByName("innerInt32") as UAVariable;

        const ns = addressSpace.getNamespaceIndex("http://test-terminal-values.example.com");
        const innerDt = addressSpace.findDataType("InnerStruct", ns)!;
        const newInner = addressSpace.constructExtensionObject(innerDt, {
            innerDateTime: new Date("2031-01-01T00:00:00.000Z"),
            innerInt32: 888
        });

        fieldInner.setValueFromSource({ dataType: DataType.ExtensionObject, value: newInner });

        innerInt32.readValue().value.value.should.eql(888);
        fieldInner.readValue().value.value.innerInt32.should.eql(888);
        parent.readValue().value.value.fieldInner.innerInt32.should.eql(888);
    });

    it("SUB-5 setValueFromSource on a GRANDCHILD terminal cascades up to the parent", () => {
        const fieldInner = child("fieldInner");
        const innerInt32 = fieldInner.getComponentByName("innerInt32") as UAVariable;

        innerInt32.setValueFromSource({ dataType: DataType.Int32, value: 99 });

        innerInt32.readValue().value.value.should.eql(99);
        fieldInner.readValue().value.value.innerInt32.should.eql(99);
        parent.readValue().value.value.fieldInner.innerInt32.should.eql(99);
    });

    it("SUB-6 writeValue and setValueFromSource on a terminal child are mutually consistent", async () => {
        const fieldInt32 = child("fieldInt32");

        fieldInt32.setValueFromSource({ dataType: DataType.Int32, value: 1 });
        parent.readValue().value.value.fieldInt32.should.eql(1);

        const sc = await fieldInt32.writeValue(context, new DataValue({ value: { dataType: DataType.Int32, value: 2 } }));
        sc.name.should.eql("Good");

        fieldInt32.readValue().value.value.should.eql(2);
        parent.readValue().value.value.fieldInt32.should.eql(2);
    });
});
