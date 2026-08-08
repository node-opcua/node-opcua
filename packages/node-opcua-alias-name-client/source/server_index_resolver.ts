/**
 * @module node-opcua-alias-name-client
 *
 * Turning the `ServerIndex` of a returned `ExpandedNodeId` into something a
 * Client can act on.
 */

import { VariableIds } from "node-opcua-constants";
import { AttributeIds } from "node-opcua-data-model";
import { type ExpandedNodeId, resolveNodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync } from "node-opcua-pseudo-session";

/** The Server's own entry in the ServerArray is always index 0 (OPC 10000-5). */
export const LOCAL_SERVER_INDEX = 0;

/**
 * Resolves `ServerIndex` values against a Server's `ServerArray`, caching it.
 *
 * `FindAlias` may return an `ExpandedNodeId` whose `serverIndex` is not 0, which
 * says only "this Node is on a different Server" — the index is meaningless
 * without the `ServerArray` that gives it a URI (OPC 10000-17 Annex A walks
 * through exactly this). Every Client consuming AliasNames from a Server that
 * aggregates has to do this step, so it lives here rather than in each caller.
 *
 * The `ServerArray` is read once and cached. It is not expected to change during
 * a session; call {@link invalidate} if the Client has reason to believe it has.
 */
export class ServerIndexResolver {
    private readonly session: IBasicSessionAsync;
    private serverArray?: string[];

    constructor(session: IBasicSessionAsync) {
        this.session = session;
    }

    /** The Server's `ServerArray`, read once and cached. */
    public async getServerArray(): Promise<string[]> {
        if (this.serverArray) {
            return this.serverArray;
        }
        const dataValue = await this.session.read({
            nodeId: resolveNodeId(VariableIds.Server_ServerArray),
            attributeId: AttributeIds.Value
        });
        const value = dataValue.value?.value;
        this.serverArray = Array.isArray(value) ? (value as string[]) : [];
        return this.serverArray;
    }

    /** Forget the cached `ServerArray`. */
    public invalidate(): void {
        this.serverArray = undefined;
    }

    /**
     * The URI for a `ServerIndex`, or `null` when the index is not in the
     * `ServerArray`.
     *
     * An index the array does not cover is a Server defect, but a Client has to
     * survive it, so it is reported as `null` rather than thrown.
     */
    public async resolveServerIndex(serverIndex: number): Promise<string | null> {
        const serverArray = await this.getServerArray();
        return serverArray[serverIndex] ?? null;
    }

    /** True when the ExpandedNodeId names a Node on the Server that answered. */
    public isLocal(expandedNodeId: ExpandedNodeId): boolean {
        return (expandedNodeId.serverIndex ?? LOCAL_SERVER_INDEX) === LOCAL_SERVER_INDEX;
    }

    /**
     * Describe where a returned Node lives.
     *
     * `serverUri` is `null` for a Node on the Server that answered the call —
     * which is every Node these packages publish, since aggregating other
     * Servers is out of scope. It is non-null only when talking to a Server that
     * does aggregate.
     */
    public async locate(
        expandedNodeId: ExpandedNodeId
    ): Promise<{ local: boolean; serverIndex: number; serverUri: string | null }> {
        const serverIndex = expandedNodeId.serverIndex ?? LOCAL_SERVER_INDEX;
        if (serverIndex === LOCAL_SERVER_INDEX) {
            return { local: true, serverIndex, serverUri: null };
        }
        return { local: false, serverIndex, serverUri: await this.resolveServerIndex(serverIndex) };
    }
}
