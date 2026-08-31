import * as tbp2n from "../dist/index.js";

describe("Test TranslateBrowsePath Service", () => {
    it("should create a TranslateBrowsePathsToNodeIdsRequest", () => {
        new tbp2n.TranslateBrowsePathsToNodeIdsRequest({});
    });
    it("should create a TranslateBrowsePathsToNodeIdsResponse", () => {
        new tbp2n.TranslateBrowsePathsToNodeIdsResponse({});
    });
});
