/***
 * @module node-opcua-buffer-utils
 */

//
// note: new Buffer(size)#  is deprecated since: v6.0. and is replaced with Buffer.allocUnsafe
//       to ensure backward compatibility we have to replace
//       new Buffer(size) with createFastUninitializedBuffer(size)
//
//       Buffer.alloc and Buffer.allocUnsafe have been introduced in nodejs 5.1.0
//  in node 0.11 new Buffer
//
// tslint:disable-next-line:ban-types
export const createFastUninitializedBuffer = Buffer.allocUnsafe;

/**
 * @method makeBuffer
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
    const b = exports.createFastUninitializedBuffer(l.length);
    let i = 0;
    l.forEach((value) => {
        b.writeUInt8(parseInt(value, 16), i);
        i += 1;
    });
    return b;
}

export function clone_buffer(buffer: Buffer): Buffer {
    const clone = exports.createFastUninitializedBuffer(buffer.length);
    buffer.copy(clone, 0, 0);
    return clone;
}
