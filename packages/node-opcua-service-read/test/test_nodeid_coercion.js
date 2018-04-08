require("should");
const bs = require("..");
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
describe("Type coercion at construction time", function () {

    it("should coerce a nodeId at construction ", function () {
        const readValue = new bs.ReadValueId({nodeId: "i=2255", attributeId: 13});
        readValue.nodeId.should.eql(makeNodeId(2255));
    });

});