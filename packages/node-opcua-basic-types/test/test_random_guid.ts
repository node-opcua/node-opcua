import should from "should";
import { cryptoRandomBytes, emptyGuid, isValidGuid, randomGuid } from "..";

describe("randomGuid - unpredictability", () => {
    it("RG-1 should produce a well formed Guid", () => {
        const guid = randomGuid();
        isValidGuid(guid).should.eql(true, `${guid} is not a valid Guid`);
        guid.should.not.eql(emptyGuid);
        guid.length.should.eql(36);
    });

    it("RG-2 should not repeat itself over a large sample", () => {
        const count = 50000;
        const seen = new Set<string>();
        for (let i = 0; i < count; i++) {
            seen.add(randomGuid());
        }
        seen.size.should.eql(count, "expecting every Guid of the sample to be distinct");
    });

    it("RG-3 should reach every byte value, including 0xFF", () => {
        // the previous implementation drew bytes with getRandomInt(0, 255), whose max is
        // exclusive: 0xFF was unreachable and each byte carried a little under 8 bits.
        const values = new Set<number>();
        for (const byte of cryptoRandomBytes(64 * 1024)) {
            values.add(byte);
        }
        values.size.should.eql(256, "expecting all 256 byte values to be reachable");
    });

    it("RG-4 should use all 16 bytes of the Guid, none left constant", () => {
        // every hex position must vary across the sample: a Guid whose tail never
        // changed would silently shrink the search space
        const positions = Array.from({ length: 36 }, () => new Set<string>());
        for (let i = 0; i < 2000; i++) {
            const guid = randomGuid();
            for (let p = 0; p < 36; p++) {
                positions[p].add(guid[p]);
            }
        }
        const dashes = [8, 13, 18, 23];
        for (let p = 0; p < 36; p++) {
            if (dashes.includes(p)) {
                positions[p].size.should.eql(1, `position ${p} should be the '-' separator`);
                continue;
            }
            positions[p].size.should.be.greaterThan(1, `hex digit at position ${p} never varies`);
        }
    });

    it("RG-5 should draw more than 65536 bytes in several WebCrypto calls", () => {
        // getRandomValues refuses more than 65536 bytes at once
        const size = 200000;
        const buffer = cryptoRandomBytes(size);
        buffer.length.should.eql(size);
        // an all-zero tail would betray a chunking bug leaving part of the buffer untouched
        const tail = buffer.subarray(size - 1024);
        should(tail.every((b) => b === 0)).eql(false, "the tail of the buffer was left uninitialized");
    });

    it("RG-6 should honour the byteOffset of a pooled buffer", () => {
        // createFastUninitializedBuffer hands out slices of a shared pool: drawing into a
        // view that ignored byteOffset would corrupt a neighbouring buffer
        const first = cryptoRandomBytes(8);
        const snapshot = Buffer.from(first);
        for (let i = 0; i < 100; i++) {
            cryptoRandomBytes(8);
        }
        first.equals(snapshot).should.eql(true, "a later draw overwrote an earlier buffer");
    });
});
