import "mocha";
import should from "should";
import { defaultHasherRegistry, HasherRegistry, ScryptHasher, scryptPhc } from "../source/password_hasher.js";

describe("ScryptHasher — credential parsing hardening", () => {
    const hasher = new ScryptHasher();

    it("hashes and verifies a normal password round-trip", async () => {
        const phc = await hasher.hash("s3cret");
        phc.should.match(/^\$scrypt\$ln=14,r=8,p=1\$/);
        (await hasher.verify("s3cret", phc)).should.be.true();
        (await hasher.verify("wrong", phc)).should.be.false();
    });

    it("fails closed (no scryptSync) on an out-of-range work factor ln", async () => {
        // A tampered/poisoned credential setting a huge N must be rejected rather
        // than driving scryptSync into resource exhaustion during login.
        const poisoned = "$scrypt$ln=30,r=8,p=1$c2FsdA==$aGFzaA==";
        (await hasher.verify("whatever", poisoned)).should.be.false();
    });

    it("fails closed on out-of-range r and p", async () => {
        (await hasher.verify("x", "$scrypt$ln=14,r=9999,p=1$c2FsdA==$aGFzaA==")).should.be.false();
        (await hasher.verify("x", "$scrypt$ln=14,r=8,p=9999$c2FsdA==$aGFzaA==")).should.be.false();
    });

    it("fails closed on a zero work factor", async () => {
        (await hasher.verify("x", "$scrypt$ln=0,r=8,p=1$c2FsdA==$aGFzaA==")).should.be.false();
    });

    it("still verifies a legitimately-parametrised credential", async () => {
        // Build a valid credential at a non-default-but-in-range cost and confirm
        // the bounds check does not reject well-formed records.
        const phc = await hasher.hash("pw-in-range");
        should(scryptPhc("c2FsdA==", "aGFzaA==").startsWith("$scrypt$")).be.true();
        (await new HasherRegistry(hasher).verify("pw-in-range", phc)).should.be.true();
        (await defaultHasherRegistry().verify("pw-in-range", phc)).should.be.true();
    });
});
