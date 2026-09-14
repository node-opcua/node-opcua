/**
 * how a part of the access policy declared in a NodeSet2 file is handled at load time.
 *
 *  - `"apply"`  : the declaration is installed on the node, as mandated by OPC UA Part 6 F.3.
 *  - `"ignore"` : the declaration is discarded. This is what node-opcua did before these options
 *                 existed: a nodeset declaring a restrictive policy would load fail-open.
 */
import type { NodesetImageStore } from "../loader/nodeset_image_store.js";

export type NodeSetPermissionsPolicy = "apply" | "ignore";

export interface NodeSetLoaderOptions {
    loadDraftNodes?: boolean;
    loadDeprecatedNodes?: boolean;
    /**
     * the `<RolePermissions>` element and the `HasNoPermissions` attribute: *who* may do *what*.
     *
     * This is a property of the information model, so it applies by default. `HasNoPermissions`
     * yields an empty permission list, which is distinct from an absent `<RolePermissions>`:
     * the former grants nothing, the latter inherits the namespace default.
     * @default "apply"
     */
    permissions?: NodeSetPermissionsPolicy;
    /**
     * the `AccessRestrictions` attribute: how the SecureChannel must be secured — signed,
     * encrypted, session-bound — before the node may be reached at all.
     *
     * This one is **opt-in**, because it is a property of the deployment rather than of the
     * model, and node-opcua cannot assume the deployment matches what the nodeset author had
     * in mind. `Opc.Ua.NodeSet2.xml` carries 359 of these, and enforcing them denies 199
     * variables under the Server Object alone — the RoleSet internals, `ServerConfiguration`,
     * method arguments — to any Session on an unsecured channel. That is the correct reading
     * of the attribute, and exactly what you want on a hardened server; it is also a large
     * behaviour change for the many deployments that run with `MessageSecurityMode.None`.
     *
     * Turn it on once your endpoints require signing or encryption.
     * @default "ignore"
     */
    accessRestrictions?: NodeSetPermissionsPolicy;
    /**
     * how much text the loader parses between two turns of the event loop, in characters, when
     * a nodeset arrives as a stream: a server starting up keeps answering while a large model
     * loads. A chunk is parsed whole, so a source delivered in one piece never yields. Zero
     * disables the yield.
     * @default 8388608 (8 MiB)
     */
    yieldEveryBytes?: number;
    /**
     * where precompiled images of the documents are kept between loads. With a store, a
     * document given whole (a path, a string, bytes) is hashed and its image replayed when the
     * store has it, parsed and written otherwise; a stream is parsed and written, and replayed
     * only when its named source carries an `imageKey`. `true` selects the default store: the
     * per-user file store of the Node.js `generateAddressSpace`, a memory store elsewhere. An
     * image the store returns that fails to read is discarded and rebuilt.
     * @default undefined (no store)
     */
    imageStore?: NodesetImageStore | boolean;
    /**
     * accept a sibling `<name>.ndjson.gz` on the strength of the source length it records,
     * without reading and hashing the XML to prove it.
     *
     * Validating a sibling image costs a read and a SHA-256 of the whole document — around
     * 30 ms of the ~110 ms it takes to replay the standard nodeset, spent proving that a file
     * nobody edited has not changed. This skips that: the recorded source length against the
     * file size becomes the whole check, and the XML is never read. The image's schema, trailer
     * and node count are still verified.
     *
     * What it gives up is precise: an XML edited in place to exactly the same byte length,
     * beside an image built from the earlier content, is replayed from the stale image. For the
     * nodesets a package ships — immutable, installed once — that cannot happen. For files a
     * user edits it can, so leave this off there.
     * @default false
     */
    trustSiblingImages?: boolean;
}
