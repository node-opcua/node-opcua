import should from "should";
import { removePadding } from "../source/utils.js";

// OPC 10000-6 6.7.2.5: PaddingSize, PaddingSize bytes each holding it, and, when the plain block is
// larger than 256 bytes (RSA keys larger than 2048 bits), ExtraPaddingSize, the high byte.
function padded(body: Buffer, nbPaddingByteTotal: number, extraPaddingByte: boolean): Buffer {
    const low = nbPaddingByteTotal % 256;
    const parts = [body, Buffer.from([low]), Buffer.alloc(nbPaddingByteTotal, low)];
    if (extraPaddingByte) {
        parts.push(Buffer.from([Math.floor(nbPaddingByteTotal / 256)]));
    }
    return Buffer.concat(parts);
}

describe("removePadding", () => {
    const body = Buffer.from("the body of the message");

    it("removes PaddingSize and its padding bytes for blocks of 256 bytes or less", () => {
        for (const total of [0, 1, 15, 200, 255]) {
            should(removePadding(padded(body, total, false), 245).toString()).eql(body.toString());
            should(removePadding(padded(body, total, false)).toString()).eql(body.toString());
        }
    });

    it("removes ExtraPaddingSize too for blocks larger than 256 bytes", () => {
        // a 3072-bit key with OAEP-SHA1 has 342-byte plain blocks; a 4096-bit one, 470
        for (const total of [0, 1, 255, 256, 300, 469]) {
            should(removePadding(padded(body, total, true), 342).toString()).eql(body.toString(), `padding of ${total}`);
        }
    });
});
