import "should";
import * as semver from "semver";
import { makeSemverCompatible } from "../source/loader/make_semver_compatible";

describe("make semver compatible", function () {
    [
        ["01.02.03", "1.2.3"],
        ["RC 1.00.3", "1.0.3"],
        [" 1.00.3 RC", "1.0.3"],
        [" 1.2 RC", "1.2.0"],
        [" 1 Beta", "1.0.0"]
    ].forEach(([actual, expected]) => {
        it(`should resolve '${actual}' to '${expected}'`, () => {
            const v = makeSemverCompatible(actual);
            v.should.equal(expected);
            semver.eq(v, expected).should.eql(true);
        });
    });
});
