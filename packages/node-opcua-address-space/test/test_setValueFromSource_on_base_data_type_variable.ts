import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { AddressSpace, type Namespace, SessionContext, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

/**
 * A variable whose dataType is BaseDataType (or any other type that is not a Structure)
 * admits every extension object: AutoID's LastScanData is declared that way and the
 * device writes an RfidScanResult into it from its Scan method. setValueFromSource used to
 * ask the address space for the extension object constructor of the *declared* dataType,
 * which asserted with no message on BaseDataType and turned that write into a failed
 * method call.
 */
describe("setValueFromSource on a variable whose dataType is not a Structure", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    const context = SessionContext.defaultContext;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.registerNamespace("urn:test:base-data-type-variable");
    });
    after(() => {
        addressSpace.dispose();
    });

    function makeRange(low: number, high: number) {
        const rangeDataType = addressSpace.findDataType("Range")!;
        return addressSpace.constructExtensionObject(rangeDataType, { low, high });
    }

    it("BDT-1 a scalar BaseDataType variable accepts an extension object", () => {
        const uaVar = namespace.addVariable({
            browseName: "LastScanDataLike",
            dataType: "BaseDataType",
            valueRank: -1,
            organizedBy: addressSpace.rootFolder.objects
        }) as UAVariable;

        uaVar.setValueFromSource(new Variant({ dataType: DataType.ExtensionObject, value: makeRange(1, 2) }));

        const dataValue = uaVar.readValue(context);
        should(dataValue.statusCode.isGood()).eql(true);
        should(dataValue.value.dataType).eql(DataType.ExtensionObject);
        should(dataValue.value.value.low).eql(1);
        should(dataValue.value.value.high).eql(2);
    });

    it("BDT-2 an array BaseDataType variable accepts an array of extension objects", () => {
        const uaVar = namespace.addVariable({
            browseName: "LastScanDataArrayLike",
            dataType: "BaseDataType",
            valueRank: 1,
            organizedBy: addressSpace.rootFolder.objects
        }) as UAVariable;

        uaVar.setValueFromSource(
            new Variant({ dataType: DataType.ExtensionObject, arrayType: 1, value: [makeRange(1, 2), makeRange(3, 4)] })
        );

        const dataValue = uaVar.readValue(context);
        should(dataValue.statusCode.isGood()).eql(true);
        should(dataValue.value.value.length).eql(2);
        should(dataValue.value.value[1].high).eql(4);
    });

    it("BDT-3 getExtensionObjectConstructor says why a non-Structure dataType has no constructor", () => {
        const baseDataType = addressSpace.findDataType("BaseDataType")!;
        should(() => addressSpace.getExtensionObjectConstructor(baseDataType.nodeId)).throw(/BaseDataType .* is not a Structure/);
    });
});
