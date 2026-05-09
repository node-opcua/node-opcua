import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";

import {
    type AddressSpace,
    type AddVariableOptions,
    type BindVariableOptionsVariation1,
    SessionContext,
    type UAVariable
} from "..";
import { getMiniAddressSpace } from "../testHelpers";

describe("testing github issue https://github.com/node-opcua/node-opcua/issues/449", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("#449 should be possible to access this in UAVariable get/set value accessor", async () => {
        const namespace = addressSpace.getOwnNamespace();

        const counterVar: AddVariableOptions = {
            browseName: "TEST",
            dataType: "String",
            minimumSamplingInterval: 100, // minimumSamplingInterval needed when using a getter
            value: {
                get: function (this: UAVariable) {
                    // in get - this.browseName works great.
                    return new Variant({
                        dataType: DataType.String,
                        value: this.browseName.toString()
                    });
                },
                set: function (this: UAVariable, _variant: Variant) {
                    // in set - it doesn't
                    this.browseName.toString().should.eql("1:TEST");
                    this.should.eql(node);
                    return StatusCodes.Good;
                }
            } as BindVariableOptionsVariation1
        };

        const node = namespace.addVariable(counterVar);

        const dataValue = new DataValue({
            value: {
                dataType: "String",
                value: ""
            }
        });

        const statusCode = await node.writeValue(SessionContext.defaultContext, dataValue);
        statusCode.should.eql(StatusCodes.Good);
    });
});
