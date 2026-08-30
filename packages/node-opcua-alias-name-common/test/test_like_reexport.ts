import should from "should";
import { DEFAULT_MAX_PATTERN_LENGTH, InvalidLikePatternError, isValidLikePattern, LikePattern, like } from "../source/index.js";

/**
 * The `Like` matcher lives in `node-opcua-like-matcher`, because `Like` is an
 * OPC 10000-4 primitive that `QueryApplications` (OPC 10000-12) and event filter
 * ContentFilters also need — neither should have to depend on the AliasName
 * package to get a dependency-free string matcher.
 *
 * It is re-exported here so Part 17 consumers still have a single import. These
 * assertions exist so moving it again cannot silently break them.
 */
describe("node-opcua-alias-name-common: Like matcher re-export", () => {
    it("should re-export a working matcher", () => {
        like("TI101", "TI%").should.eql(true);
        like("FIT-101", "TI%").should.eql(false);
    });

    it("should re-export the compiled-pattern form", () => {
        new LikePattern("%101").test("TI101").should.eql(true);
    });

    it("should re-export the typed error, so instanceof still works across the package boundary", () => {
        should(() => like("a", "a[")).throw(InvalidLikePatternError);
    });

    it("should re-export the validity check and the length limit", () => {
        isValidLikePattern("TI%").should.eql(true);
        isValidLikePattern("a[").should.eql(false);
        DEFAULT_MAX_PATTERN_LENGTH.should.be.a.Number();
    });
});
