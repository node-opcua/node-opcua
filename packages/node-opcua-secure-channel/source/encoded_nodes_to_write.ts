/**
 * @module node-opcua-secure-channel
 *
 * The bytes the WriteValues of a WriteRequest arrived as. A server that hands a Write on to
 * another thread or process (a front thread to its engine) can send these bytes instead of
 * encoding again the WriteValues it has just decoded from them: they are already the count of
 * the array followed by the WriteValues, as encodeArray writes them.
 */
import { BinaryStream } from "node-opcua-binary-stream";
import { RequestHeader } from "node-opcua-types";

const encodedArrays = new WeakMap<object, Uint8Array>();

/**
 * keeps a copy of the nodesToWrite of a just decoded WriteRequest: the bytes of `body` after its
 * RequestHeader, which starts at `requestHeaderStart` (after the type id). A copy, because the
 * body may be a view into a buffer the transport reuses.
 */
export function retainEncodedNodesToWrite(nodesToWrite: unknown[], body: Buffer, requestHeaderStart: number): void {
    const stream = new BinaryStream(body);
    stream.length = requestHeaderStart;
    new RequestHeader().decode(stream);
    encodedArrays.set(nodesToWrite, new Uint8Array(body.subarray(stream.length)));
}

/**
 * the bytes `nodesToWrite` arrived as (its count, then the WriteValues), or undefined when
 * they are not known or no longer match it
 */
export function encodedNodesToWrite(nodesToWrite: unknown[]): Uint8Array | undefined {
    return encodedArrays.get(nodesToWrite);
}

/** the WriteValues have been changed since they were decoded: their bytes no longer stand for them */
export function forgetEncodedNodesToWrite(nodesToWrite: unknown[]): void {
    encodedArrays.delete(nodesToWrite);
}
