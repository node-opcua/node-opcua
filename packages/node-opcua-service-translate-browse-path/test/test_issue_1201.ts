import { resolveNodeId } from "node-opcua-nodeid";
import { ReferenceTypeIds } from "node-opcua-constants";
import { constructBrowsePathFromQualifiedName } from "..";

describe("test constructBrowsePathFromQualifiedName", function () {
    it("should use Organizes as default referenceTypeId", function () {
        const path = constructBrowsePathFromQualifiedName({ 
            nodeId: resolveNodeId("RootFolder") 
        }, [
            "ConditionType"
        ]);
        path.relativePath.elements![0].referenceTypeId.toString().should.eql(resolveNodeId(ReferenceTypeIds.Aggregates).toString());
    });
});
