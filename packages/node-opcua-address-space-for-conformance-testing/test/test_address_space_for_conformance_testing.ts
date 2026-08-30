import should from "should";

import * as conformance from "..";

// the original file was a bare `require("..")`: the point is that importing the package
// resolves and evaluates without throwing. Stated as an assertion so a regression reports
// itself rather than passing an empty file.
describe("node-opcua-address-space-for-conformance-testing", () => {
    it("should expose build_address_space_for_conformance_testing", () => {
        should.exist(conformance.build_address_space_for_conformance_testing);
        conformance.build_address_space_for_conformance_testing.should.be.instanceOf(Function);
    });
});
