import "should";
import { makeNodeId } from "node-opcua-nodeid";
import * as bs from "../dist/index.js";

describe("Type coercion at construction time", () => {
    it("should coerce a nodeId at construction ", () => {
        const readValue = new bs.ReadValueId({ nodeId: "i=2255", attributeId: 13 });
        readValue.nodeId.should.eql(makeNodeId(2255));
    });
});
