require("should");
var bs = require("..");
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
describe("Type coercion at construction time", function () {

    it("should coerce a nodeId at construction ", function () {
        var readValue = new bs.ReadValueId({nodeId: "i=2255", attributeId: 13});
        readValue.nodeId.should.eql(makeNodeId(2255));
    });

});