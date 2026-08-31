import { BinaryStream, BinaryStreamArrayLengthExceededError } from "node-opcua-binary-stream";
import should from "should";
import { decodeArray, encodeArray } from "../dist/index.js";

//
// decodeArray is the decoder for every structured-type array field on the wire
// (ReadRequest.nodesToRead, BrowseRequest.nodesToBrowse, ...). It must refuse an array
// length that the remaining bytes cannot back, rather than loop over it.
//

describe("decodeArray length guard", () => {
    it("round-trips a normal array unchanged", () => {
        const out = new BinaryStream(64);
        encodeArray([10, 20, 30, 40], out, (v, s) => s.writeUInt8(v));

        const input = new BinaryStream(out.buffer.subarray(0, out.length));
        should(decodeArray(input, (s) => s.readUInt8())).eql([10, 20, 30, 40]);
    });

    it("preserves the null-array sentinel (length 0xffffffff)", () => {
        const out = new BinaryStream(16);
        encodeArray(null, out, () => {
            /* never called */
        });
        const input = new BinaryStream(out.buffer.subarray(0, out.length));
        should(decodeArray(input, () => 0)).eql(null);
    });

    it("rejects an implausibly large length without decoding a single element", () => {
        // length prefix 0x7ffffffe behind an 8-byte body
        const buf = Buffer.alloc(12);
        buf.writeUInt32LE(0x7ffffffe, 0);
        const input = new BinaryStream(buf);

        let elementsDecoded = 0;
        should(() =>
            decodeArray(input, (s) => {
                elementsDecoded++;
                return s.readUInt8();
            })
        ).throw(BinaryStreamArrayLengthExceededError);
        elementsDecoded.should.eql(0, "must reject before the loop, not after exhausting the buffer");
    });

    it("honours a lowered BinaryStream.maxArrayLength ceiling", () => {
        const saved = BinaryStream.maxArrayLength;
        BinaryStream.maxArrayLength = 3;
        try {
            const buf = Buffer.alloc(64);
            buf.writeUInt32LE(4, 0); // 4 elements, ceiling is 3
            const input = new BinaryStream(buf);
            should(() => decodeArray(input, (s) => s.readUInt8())).throw(BinaryStreamArrayLengthExceededError);
        } finally {
            BinaryStream.maxArrayLength = saved;
        }
    });
});
