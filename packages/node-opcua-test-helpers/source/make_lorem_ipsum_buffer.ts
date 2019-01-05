import { loremIpsum } from "./lorem_ipsum";

export function make_lorem_ipsum_buffer(): Buffer {
    return Buffer.from(loremIpsum);
}

export function make_simple_buffer(chunkSize: number): Buffer {

    // feed chunk-manager on byte at a time
    const n = (chunkSize) * 4 + 12;

    const buf = Buffer.allocUnsafe(n);
    for (let i = 0; i < n; i += 1) {
        buf.writeUInt8(i % 256, i);
    }
    return buf;
}
