import { coerceNodeId, type NodeId } from "node-opcua-nodeid";
import { Argument, type ArgumentOptions } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";

import "../source/imports";

// constructHook is typed as returning unknown: this is the shape of the
// coerced argument options that the tests below inspect.
interface CoercedArgument {
    name: string;
    dataType: NodeId;
    valueRank: number;
    arrayDimensions?: number[];
}

describe("Argument.schema.ConstructHook - issue#1084", () => {
    it("should not override arrayDimension when valueRank>1", () => {
        const argument: ArgumentOptions = {
            name: "InputA",
            dataType: DataType.String,
            valueRank: 2,
            arrayDimensions: [3, 3]
        };

        const arg = Argument.schema.constructHook!(argument) as CoercedArgument;
        arg.name.should.eql("InputA");
        arg.dataType.should.eql(coerceNodeId(DataType.String));
        arg.valueRank.should.eql(2);
        should(arg.arrayDimensions).eql([3, 3]);
    });
    it("should not override arrayDimension when valueRank>1", () => {
        const argument: ArgumentOptions = {
            name: "InputB",
            dataType: DataType.String,
            valueRank: -1
        };

        const arg = Argument.schema.constructHook!(argument) as CoercedArgument;
        arg.name.should.eql("InputB");
        arg.dataType.should.eql(coerceNodeId(DataType.String));
        arg.valueRank.should.eql(-1);
        should.not.exist(arg.arrayDimensions);
    });
});
