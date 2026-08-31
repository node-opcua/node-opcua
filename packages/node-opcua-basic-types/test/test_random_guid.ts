import should from "should";
import { cryptoRandomBytes, emptyGuid, isValidGuid, randomGuid } from "../dist/index.js";

describe("randomGuid", () => {
    it("RG-1 should produce a well formed, non empty Guid", () => {
        const guid = randomGuid();
        isValidGuid(guid).should.eql(true, `${guid} is not a valid Guid`);
        guid.should.not.eql(emptyGuid);
        randomGuid().should.not.eql(guid);
    });

    it("RG-2 should fill buffers larger than the 65536 byte WebCrypto limit", () => {
        const size = 200000;
        const buffer = cryptoRandomBytes(size);
        buffer.length.should.eql(size);
        // an all-zero tail would betray a chunking bug leaving part of the buffer untouched
        should(buffer.subarray(size - 1024).every((b) => b === 0)).eql(false);
    });

    it("RG-3 should honour the byteOffset of a pooled buffer", () => {
        // view that ignored byteOffset would corrupt a neighbouring buffer
        const first = cryptoRandomBytes(8);
        const snapshot = Buffer.from(first);
        for (let i = 0; i < 100; i++) {
            cryptoRandomBytes(8);
        }
        first.equals(snapshot).should.eql(true, "a later draw overwrote an earlier buffer");
    });
});
