const { makeAccessRestrictionsFlag, accessRestrictionsFlagToString, AccessRestrictionsFlag } = require("..");

describe("Testing AccessRestrictionsFlag", function () {
    it("should create a access restrictions flags from a string", function () {
        makeAccessRestrictionsFlag("SigningRequired").should.equal(0x01);
        makeAccessRestrictionsFlag("EncryptionRequired").should.equal(0x02);
        makeAccessRestrictionsFlag("SessionRequired | ApplyRestrictionsToBrowse").should.equal(0x0c);

        AccessRestrictionsFlag[0x1].should.eql("SigningRequired");
        AccessRestrictionsFlag[0x2].should.eql("EncryptionRequired");

        makeAccessRestrictionsFlag(makeAccessRestrictionsFlag("SigningRequired")).should.equal(0x01);
    });

    it("AccessRestrictionsFlagToString", () => {
        accessRestrictionsFlagToString(AccessRestrictionsFlag.SigningRequired).should.eql("SigningRequired");
        accessRestrictionsFlagToString(
            AccessRestrictionsFlag.EncryptionRequired | AccessRestrictionsFlag.ApplyRestrictionsToBrowse
        ).should.eql("EncryptionRequired | ApplyRestrictionsToBrowse");
        accessRestrictionsFlagToString(AccessRestrictionsFlag.SessionRequired).should.eql("SessionRequired");
        accessRestrictionsFlagToString(0).should.eql("None");
    });
});
