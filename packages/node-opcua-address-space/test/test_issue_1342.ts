import should from "should";
import sinon from "sinon";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-basic-types";
import { Variant } from "node-opcua-variant";
import { AddressSpace, Namespace } from "..";
import { generateAddressSpace } from "../distNodeJS";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/1342", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 20000));
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        namespace = addressSpace.registerNamespace("Private");
    });

    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it("using simple getter should still adjust timestamp when item is monitored", async () => {
        let counter = 0;
        // create objectType "Test" with variable "Test"
        const uaVariable = namespace.addVariable({
            browseName: "TestVariable",
            dataType: DataType.UInt32,
            minimumSamplingInterval: 10,
            value: {
                get: () => {
                    counter++;
                    return new Variant({
                        dataType: DataType.UInt32,
                        value: counter
                    });
                }
            }
        });
        await wait(100);
        const dataValue1 = uaVariable.readValue();
        await wait(100);
        const dataValue2 = uaVariable.readValue();
        await wait(100);
        const dataValue3 = uaVariable.readValue();
        console.log(dataValue1.toString(), dataValue2.toString());

        should(dataValue1.sourceTimestamp?.getTime()).be.below(dataValue2.sourceTimestamp!.getTime());
        should(dataValue2.sourceTimestamp?.getTime()).be.below(dataValue3.sourceTimestamp!.getTime());
    });
});
