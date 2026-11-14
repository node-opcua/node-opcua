/**
 * @module node-opcua-server
 *
 * The string a session token is known by in the maps of the front threads: NodeId.toString(). The
 * tokens a server hands out are opaque, 32 random bytes, whose string is their base64 encoding, made
 * again for each request without this cache (a request decodes a new NodeId). The cache holds the string
 * of each token by its first 4 bytes and is used only when all the bytes are the same.
 */
import { type NodeId } from "node-opcua-nodeid";
export declare function tokenKeyOf(token: NodeId): string;
//# sourceMappingURL=token_key.d.ts.map