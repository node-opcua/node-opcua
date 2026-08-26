/***
 * @module node-opcua-buffer-utils
 */

/**

 * turn a string make of hexadecimal bytes into a buffer
 *
 * @example
 *     const buffer = makeBuffer("BE EF");
 *
 * @param listOfBytes
 * @return {Buffer}
 */
export function makeBuffer(listOfBytes: string): Buffer {
    const l = listOfBytes.split(" ");
    const b = Buffer.allocUnsafe(l.length);
    let i = 0;
    l.forEach((value) => {
        b.writeUInt8(parseInt(value, 16), i);
        i += 1;
    });
    return b;
}

