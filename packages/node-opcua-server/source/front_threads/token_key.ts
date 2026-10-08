/**
 * @module node-opcua-server
 *
 * The string a session token is known by in the maps of the front threads: NodeId.toString(). The
 * tokens a server hands out are opaque, 32 random bytes, whose string is their base64 encoding, made
 * again for each request without this cache (a request decodes a new NodeId). The cache holds the string
 * of each token by its first 4 bytes and is used only when all the bytes are the same.
 */
import { type NodeId, NodeIdType } from "node-opcua-nodeid";

const MAX_TOKENS = 65536;
const known = new Map<number, { namespace: number; bytes: Buffer; key: string }>();

export function tokenKeyOf(token: NodeId): string {
    const value = token.value;
    if (token.identifierType !== NodeIdType.BYTESTRING || !Buffer.isBuffer(value) || value.length < 4) {
        return token.toString();
    }
    const head = value.readUInt32LE(0);
    const entry = known.get(head);
    if (entry && entry.namespace === token.namespace && entry.bytes.equals(value)) return entry.key;
    const key = token.toString();
    if (known.size >= MAX_TOKENS) known.clear();
    known.set(head, { namespace: token.namespace, bytes: Buffer.from(value), key });
    return key;
}
