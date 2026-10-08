/**
 * @module node-opcua-secure-channel
 *
 * The encoded body of a request (its type, then its fields) kept as it arrived, for the request types
 * a server asks for: a server that hands a request to another thread passes these bytes on instead of
 * encoding the request again (the front threads of node-opcua-server).
 */

const kept = new Set<string>();
const bodies = new WeakMap<object, Uint8Array>();

/** the request types, by schema name, whose encoded body is kept from now on (in this thread) */
export function retainEncodedBodies(names: Iterable<string>): void {
    for (const name of names) kept.add(name);
}

/** called by the message builder for each request it decoded */
export function retainEncodedBody(request: object, name: string, body: Buffer): void {
    if (kept.has(name)) bodies.set(request, new Uint8Array(body));
}

/** the bytes `request` arrived as, when its type is kept; a request changed since is not to be sent as these */
export function encodedBodyOf(request: object): Uint8Array | undefined {
    return bodies.get(request);
}
