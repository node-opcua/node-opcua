import { ReferenceTypeIds } from "node-opcua-constants";
import { resolveNodeId } from "node-opcua-nodeid";
import should from "should";
import { constructBrowsePathFromQualifiedName } from "../dist/index.js";

describe("test constructBrowsePathFromQualifiedName", () => {
    it("should use Organizes as default referenceTypeId", () => {
        const path = constructBrowsePathFromQualifiedName(
            {
                nodeId: resolveNodeId("RootFolder")
            },
            ["ConditionType"]
        );
        should(path.relativePath.elements?.[0].referenceTypeId.toString()).eql(
            resolveNodeId(ReferenceTypeIds.Aggregates).toString()
        );
    });
});
