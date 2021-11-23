import { DataType } from "node-opcua-variant";
import { Argument, ArgumentOptions } from "node-opcua-types";
import { coerceNodeId } from "node-opcua-nodeid";
import * as should from "should";

import "../source/imports";

describe("Argument.schema.ConstructHook - issue#1084", () => {
    it("should not override arrayDimension when valueRank>1", () => {
        const argument: ArgumentOptions = {
            name: "InputA",
            dataType: DataType.String,
            valueRank: 2,
            arrayDimensions: [3, 3]
        };

        const arg = Argument.schema.constructHook!(argument);
        arg.name.should.eql("InputA");
        arg.dataType.should.eql(coerceNodeId(DataType.String));
        arg.valueRank.should.eql(2);
        arg.arrayDimensions.should.eql([3, 3]);
    });
    it("should not override arrayDimension when valueRank>1", () => {
        const argument: ArgumentOptions = {
            name: "InputB",
            dataType: DataType.String,
            valueRank: -1
        };

        const arg = Argument.schema.constructHook!(argument);
        arg.name.should.eql("InputB");
        arg.dataType.should.eql(coerceNodeId(DataType.String));
        arg.valueRank.should.eql(-1);
        should.not.exist(arg.arrayDimensions);
    });
});
