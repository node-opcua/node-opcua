import { AttributeIds } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type UAVariable, type UAVariableType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * FEAT-53 (CTT Base Information / Base Info Selection List 001): the standard nodeset never
 * states a DataType attribute for SelectionListType (i=16309) or its Selections property
 * (i=17632); per the UANodeSet XML schema an omitted DataType defaults to BaseDataType
 * (ns=0;i=24). node-opcua's loader answered Null (ns=0;i=0) instead, so the CTT script
 * failed with "The DataType of node i=16309, is not <i=24> but instead <i=0>".
 */
describe("FEAT-53 an omitted DataType attribute defaults to BaseDataType", function (this: Mocha.Suite) {
    this.timeout(60_000);

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("urn:feat-53");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    const baseDataType = new NodeId(NodeId.NodeIdType.NUMERIC, 24, 0);

    it("SelectionListType (i=16309) DataType attribute reads as BaseDataType", () => {
        const selectionListType = addressSpace.findNode("i=16309") as UAVariableType;
        should.exist(selectionListType);
        const dataValue = selectionListType.readAttribute(null, AttributeIds.DataType);
        should(dataValue.value.dataType).eql(DataType.NodeId);
        should(dataValue.value.value as NodeId).eql(baseDataType);
    });

    it("Selections property (i=17632) DataType attribute reads as BaseDataType", () => {
        const selections = addressSpace.findNode("i=17632") as UAVariable;
        should.exist(selections);
        const dataValue = selections.readAttribute(null, AttributeIds.DataType);
        should(dataValue.value.dataType).eql(DataType.NodeId);
        should(dataValue.value.value as NodeId).eql(baseDataType);
    });

    it("SelectionListType can be instantiated", () => {
        const selectionListType = addressSpace.findVariableType("SelectionListType") as UAVariableType;
        should.exist(selectionListType);
        const instance = selectionListType.instantiate({
            browseName: "MySelectionList",
            organizedBy: addressSpace.rootFolder.objects
        });
        should.exist(instance);
        const dataValue = instance.readAttribute(null, AttributeIds.DataType);
        should(dataValue.value.value as NodeId).eql(baseDataType);
    });
});
