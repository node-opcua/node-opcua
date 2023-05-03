const { resolveNodeId } = require("node-opcua-nodeid");
const { ReferenceTypeIds } = require("node-opcua-constants");
const { constructBrowsePathFromQualifiedName } = require("..");

describe("test constructBrowsePathFromQualifiedName", function () {
    it("should use Organizes as default referenceTypeId", function () {
        const path = constructBrowsePathFromQualifiedName({ nodeId: resolveNodeId("RootFolder") }, ["ConditionType"]);
        path.relativePath.elements[0].referenceTypeId.toString().should.eql(resolveNodeId(ReferenceTypeIds.Aggregates).toString());
    });
});
