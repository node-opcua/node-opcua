import fs from "node:fs";
import path from "node:path";
import type { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS.js";

interface AddressSpaceWithExtraDataTypeManager {
    $$extraDataTypeManager: ExtraDataTypeManager | undefined;
    getDataTypeManager(): ExtraDataTypeManager;
}

interface UADataTypeWithExtensionObjectConstructor {
    _extensionObjectConstructor: unknown;
}

/**
 * A nodeset carrying a single malformed <Value> (declared DataType="UInt32" but the value is a
 * ListOfInt32 — as shipped in Opc.Ua.PADIM.NodeSet2.xml) used to abort *all* remaining post-loading
 * steps: the failing task was re-run inside the catch block of performPostLoadingTasks, the second
 * throw escaped, finalSteps() was abandoned and swallowed by a no-op renderError(), so
 * ensureDatatypeExtracted() never ran. generateAddressSpace() resolved normally, but the address
 * space had no DataTypeManager and any later use of a structured DataType (EURange, EUInformation,
 * ...) failed with
 *   "Cannot read properties of undefined (reading 'getExtensionObjectConstructorFromDataType')".
 */
describe("generateAddressSpace resilience to malformed <Value> in a nodeset", () => {
    const xmlFile = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_mismatched_value_datatype.xml");
    fs.existsSync(xmlFile).should.eql(true, `should find ${xmlFile}`);

    let addressSpace: AddressSpace;
    beforeEach(() => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("urn:own");
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("RES-1 should skip the malformed value, still initialise the other variables and still build the DataTypeManager", async () => {
        await generateAddressSpace(addressSpace, [nodesets.standard, xmlFile]);

        const nsIndex = addressSpace.getNamespaceIndex("http://A");
        nsIndex.should.be.greaterThan(0);

        // the good variable next to the bad one must have been initialised
        const good = addressSpace.findNode(`ns=${nsIndex};i=1001`) as UAVariable;
        should.exist(good);
        const goodValue = good.readValue();
        goodValue.statusCode.should.eql(StatusCodes.Good);
        goodValue.value.dataType.should.eql(DataType.UInt32);
        goodValue.value.value.should.eql(42);

        // the bad variable exists, but its mismatched value was not applied
        const bad = addressSpace.findNode(`ns=${nsIndex};i=1000`) as UAVariable;
        should.exist(bad);
        bad.readValue().statusCode.should.not.eql(StatusCodes.Good);

        // and, crucially, the DataTypeManager must be available
        should.exist(
            (addressSpace as unknown as AddressSpaceWithExtraDataTypeManager).$$extraDataTypeManager,
            "DataTypeManager must be initialised"
        );
        should.doesNotThrow(() => (addressSpace as unknown as AddressSpaceWithExtraDataTypeManager).getDataTypeManager());
    });

    it("RES-2 should still allow structured values (EURange) to be set after loading such a nodeset", async () => {
        await generateAddressSpace(addressSpace, [nodesets.standard, xmlFile]);

        const namespace = addressSpace.getOwnNamespace();
        const analogItem = namespace.addAnalogDataItem({
            browseName: "Temperature",
            dataType: "Float",
            engineeringUnitsRange: { low: -40, high: 125 }
        });
        const euRange = analogItem.euRange.readValue();
        euRange.statusCode.should.eql(StatusCodes.Good);
        euRange.value.dataType.should.eql(DataType.ExtensionObject);
        euRange.value.value.low.should.eql(-40);
        euRange.value.value.high.should.eql(125);
    });

    it("RES-3 getExtensionObjectConstructor should raise an explicit error when the DataTypeManager is missing", async () => {
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        // simulate an address space whose DataType extraction never ran
        const priv = addressSpace as unknown as AddressSpaceWithExtraDataTypeManager;
        const saved = priv.$$extraDataTypeManager;
        priv.$$extraDataTypeManager = undefined;
        try {
            const range = addressSpace.findDataType("Range")!;
            should.exist(range);
            (range as unknown as UADataTypeWithExtensionObjectConstructor)._extensionObjectConstructor = undefined;
            should.throws(
                () => addressSpace.getExtensionObjectConstructor(range),
                /DataType manager is not initialised.*ensureDatatypeExtracted/
            );
        } finally {
            priv.$$extraDataTypeManager = saved;
        }
    });
});
