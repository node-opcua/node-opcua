import "should";
import { emptyGuid, isValidGuid } from "..";

describe("GUID", () => {
    it("emptyGuid should be a valid GUID", () => {
        isValidGuid(emptyGuid).should.equal(true);
    });

    it("should detect strings that looks like GUID", () => {
        isValidGuid("72962B91-FA75-4AE6-8D28-B404DC7DAF63").should.equal(true);
        isValidGuid("zz962B91-FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);
        isValidGuid("72962B-91FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);

        isValidGuid("111111172962B-91FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);
        isValidGuid("72962B-91FA75-4AE6-8D28-B404DC7DAF639999999").should.equal(false);
        isValidGuid(emptyGuid).should.equal(true);
    });

    it("should accept letters in lower case in GUID strings", () => {
        isValidGuid("72962b91-fa75-4ae6-8d28-b404dc7daf63").should.equal(true);
        isValidGuid("zz962B91-FA75-4AE6-8D28-B404DC7DAF63").should.equal(false);
        isValidGuid("72962b-91fa75-4ae6-8d28-b404dc7daf63").should.equal(false);

        isValidGuid("111111172962b-91fa75-4ae6-8d28-b404dc7daf63").should.equal(false);
        isValidGuid("72962b-91fa75-4ae6-8d28-b404dc7daf639999999").should.equal(false);
    });

    it("should not detect ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32 as a GUID", () => {
        isValidGuid("ns=0;g=1E14849E-3744-470d-8C7B-5F9110C2FA32").should.equal(false);
    });
});
