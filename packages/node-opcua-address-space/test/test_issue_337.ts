import * as should from "should";

import { NumericRange } from "node-opcua-numeric-range";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { AddressSpace } from "..";
import { getMiniAddressSpace } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing bug found in #337", () => {

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });

    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should handle Matrix ", () => {

        const namespace = addressSpace.getOwnNamespace();

        const n = namespace.addVariable({
            arrayDimensions: [3, 3],
            browseName: "position",
            dataType: "Double",
            nodeId: "ns=1;s=Position",
            organizedBy: addressSpace.rootFolder.objects,
            value: {
                get: () => {
                    return new Variant({
                        arrayType: VariantArrayType.Matrix,
                        dataType: DataType.Double,
                        dimensions: [3, 3],
                        value: [1, 2, 3, 4, 5, 6, 7, 8, 9]
                    });
                }
            },
            valueRank: 2,
        });

        const dataValue = n.readValue(null, new NumericRange());
        dataValue.isValid().should.eql(true);
        dataValue.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValue.value.dimensions!.should.eql([3, 3]);

    });

});
