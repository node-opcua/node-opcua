import path from "node:path";
import { DiagnosticInfo, LocalizedText, QualifiedName } from "node-opcua-data-model";
import { coerceNodeId, NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { AddressSpace, SessionContext, type UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

/**
 * Bug: setValueFromSource on a bound extension object fails to update
 * terminal value types that are `instanceof Object` (Date, Buffer, NodeId,
 * QualifiedName, LocalizedText, DiagnosticInfo, arrays, etc.) because
 * _update_extension_object recurses into them instead of assigning directly.
 *
 * Uses the all_terminal_value_types.xml fixture which defines:
 * - InnerStruct (innerDateTime + innerInt32)
 * - AllTerminalsStruct (all terminal types + nested InnerStruct)
 * - A variable instance at ns=1;i=6000
 */
describe("Bug - setValueFromSource should correctly update terminal value types in extension objects", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    const context = SessionContext.defaultContext;

    const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/all_terminal_value_types.xml");

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);
    });
    after(() => {
        addressSpace.dispose();
    });

    function getNamespaceIndex(): number {
        return addressSpace.getNamespaceIndex("http://test-terminal-values.example.com");
    }

    let testVar: UAVariable;

    beforeEach(() => {
        const ns = getNamespaceIndex();
        testVar = addressSpace.findNode(`ns=${ns};i=6000`) as UAVariable;
        // Bind the extension object — this installs the proxy and overrides
        // setValueFromSource to use setExtensionObjectPartialValue (the buggy path).
        testVar.bindExtensionObject(undefined, { createMissingProp: true });
    });

    function constructNewExtObj(overrides: Record<string, unknown>) {
        const ns = getNamespaceIndex();
        const dt = addressSpace.findDataType("AllTerminalsStruct", ns)!;
        const defaults: Record<string, unknown> = {
            fieldDateTime: new Date("2026-01-01T00:00:00.000Z"),
            fieldByteString: Buffer.from("AABB", "hex"),
            fieldNodeId: coerceNodeId("ns=1;i=100"),
            fieldQualifiedName: new QualifiedName({ namespaceIndex: 1, name: "Initial" }),
            fieldLocalizedText: new LocalizedText({ locale: "en", text: "Hello" }),
            fieldDiagnosticInfo: new DiagnosticInfo({}),
            fieldInt32: 10,
            fieldInt32Array: [1, 2, 3],
            fieldInner: { innerDateTime: new Date("2026-01-01T00:00:00.000Z"), innerInt32: 5 }
        };
        return addressSpace.constructExtensionObject(dt, { ...defaults, ...overrides });
    }

    it("TV-1 setValueFromSource should update a DateTime (Date) field", () => {
        const uaVar = testVar;
        const updatedDate = new Date("2030-06-15T12:00:00.000Z");
        const newExtObj = constructNewExtObj({ fieldDateTime: updatedDate });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        result.fieldDateTime.should.be.instanceof(Date);
        result.fieldDateTime.toISOString().should.eql("2030-06-15T12:00:00.000Z");
    });

    it("TV-2 setValueFromSource should update a ByteString (Buffer) field", () => {
        const uaVar = testVar;
        const updatedBuffer = Buffer.from("CCDD", "hex");
        const newExtObj = constructNewExtObj({ fieldByteString: updatedBuffer });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        Buffer.isBuffer(result.fieldByteString).should.eql(true);
        result.fieldByteString.toString("hex").should.eql("ccdd");
    });

    it("TV-3 setValueFromSource should update a NodeId field", () => {
        const uaVar = testVar;
        const updatedNodeId = coerceNodeId("ns=2;i=999");
        const newExtObj = constructNewExtObj({ fieldNodeId: updatedNodeId });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        result.fieldNodeId.should.be.instanceof(NodeId);
        result.fieldNodeId.toString().should.eql(updatedNodeId.toString());
    });

    it("TV-4 setValueFromSource should update a QualifiedName field", () => {
        const uaVar = testVar;
        const updatedQN = new QualifiedName({ namespaceIndex: 2, name: "Updated" });
        const newExtObj = constructNewExtObj({ fieldQualifiedName: updatedQN });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        result.fieldQualifiedName.name.should.eql("Updated");
        result.fieldQualifiedName.namespaceIndex.should.eql(2);
    });

    it("TV-5 setValueFromSource should update a LocalizedText field", () => {
        const uaVar = testVar;
        const updatedLT = new LocalizedText({ locale: "fr", text: "Bonjour" });
        const newExtObj = constructNewExtObj({ fieldLocalizedText: updatedLT });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        result.fieldLocalizedText.text.should.eql("Bonjour");
        result.fieldLocalizedText.locale.should.eql("fr");
    });

    it("TV-6 setValueFromSource should update a DiagnosticInfo field", () => {
        const uaVar = testVar;
        const updatedDI = new DiagnosticInfo({ additionalInfo: "updated" });
        const newExtObj = constructNewExtObj({ fieldDiagnosticInfo: updatedDI });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        result.fieldDiagnosticInfo.additionalInfo.should.eql("updated");
    });

    it("TV-7 setValueFromSource should update an Int32 array field", () => {
        const uaVar = testVar;
        const newExtObj = constructNewExtObj({ fieldInt32Array: [10, 20, 30, 40] });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        Array.from(result.fieldInt32Array).should.eql([10, 20, 30, 40]);
    });

    it("TV-8 setValueFromSource should still recurse into nested extension objects (InnerStruct)", () => {
        const uaVar = testVar;
        const newInnerDate = new Date("2029-12-31T23:59:59.000Z");
        const newExtObj = constructNewExtObj({
            fieldInner: { innerDateTime: newInnerDate, innerInt32: 99 }
        });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        result.fieldInner.innerInt32.should.eql(99);
        result.fieldInner.innerDateTime.should.be.instanceof(Date);
        result.fieldInner.innerDateTime.toISOString().should.eql("2029-12-31T23:59:59.000Z");
    });

    it("TV-9 setValueFromSource should update a primitive Int32 field (control test)", () => {
        const uaVar = testVar;
        const newExtObj = constructNewExtObj({ fieldInt32: 42 });

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        const result = uaVar.readValue(context).value.value;
        result.fieldInt32.should.eql(42);
    });

    // --------------- Notification Bug Tests ---------------
    // The deeper issue: with the broken code, terminal types are recursed
    // into at the raw-object level, so the child variable's `value_changed`
    // event is never emitted (touchValue is never called because the field
    // never enters `variablesToUpdate`).

    it("NB-1 setValueFromSource should emit value_changed on the NodeId child variable", () => {
        const uaVar = testVar;
        const fieldNodeIdVar = uaVar.getComponentByName("fieldNodeId") as UAVariable;
        should.exist(fieldNodeIdVar, "fieldNodeId child variable should exist");

        let notified = false;
        fieldNodeIdVar.on("value_changed", () => {
            notified = true;
        });

        const updatedNodeId = coerceNodeId("ns=2;i=999");
        const newExtObj = constructNewExtObj({ fieldNodeId: updatedNodeId });
        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        fieldNodeIdVar.removeAllListeners("value_changed");
        notified.should.eql(true, "value_changed should have been emitted on fieldNodeId child variable");
    });

    it("NB-2 setValueFromSource should emit value_changed on the QualifiedName child variable", () => {
        const uaVar = testVar;
        const fieldQNVar = uaVar.getComponentByName("fieldQualifiedName") as UAVariable;
        should.exist(fieldQNVar, "fieldQualifiedName child variable should exist");

        let notified = false;
        fieldQNVar.on("value_changed", () => {
            notified = true;
        });

        const updatedQN = new QualifiedName({ namespaceIndex: 2, name: "Updated" });
        const newExtObj = constructNewExtObj({ fieldQualifiedName: updatedQN });
        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        fieldQNVar.removeAllListeners("value_changed");
        notified.should.eql(true, "value_changed should have been emitted on fieldQualifiedName child variable");
    });

    it("NB-3 setValueFromSource should emit value_changed on the Int32 child (control - primitive)", () => {
        const uaVar = testVar;
        const fieldInt32Var = uaVar.getComponentByName("fieldInt32") as UAVariable;
        should.exist(fieldInt32Var, "fieldInt32 child variable should exist");

        let notified = false;
        fieldInt32Var.on("value_changed", () => {
            notified = true;
        });

        const newExtObj = constructNewExtObj({ fieldInt32: 42 });
        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        fieldInt32Var.removeAllListeners("value_changed");
        notified.should.eql(true, "value_changed should have been emitted on fieldInt32 child variable (control)");
    });

    it("NB-4 setValueFromSource should emit value_changed on the LocalizedText child variable", () => {
        const uaVar = testVar;
        const fieldLTVar = uaVar.getComponentByName("fieldLocalizedText") as UAVariable;
        should.exist(fieldLTVar, "fieldLocalizedText child variable should exist");

        let notified = false;
        fieldLTVar.on("value_changed", () => {
            notified = true;
        });

        const updatedLT = new LocalizedText({ locale: "fr", text: "Bonjour" });
        const newExtObj = constructNewExtObj({ fieldLocalizedText: updatedLT });
        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: newExtObj }));

        fieldLTVar.removeAllListeners("value_changed");
        notified.should.eql(true, "value_changed should have been emitted on fieldLocalizedText child variable");
    });
});
