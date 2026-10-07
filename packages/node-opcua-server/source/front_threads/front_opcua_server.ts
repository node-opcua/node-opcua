/**
 * @module node-opcua-server
 *
 * The server of a front thread: every service of an OPCUAServer, over a RemoteEngine. The front
 * listens, secures channels and encodes; the one server behind it is the engine thread's, so
 * that every front shows the same address space, sessions and diagnostics.
 */
import type { EventTypeLike, RaiseEventData, UAObjectType } from "node-opcua-address-space";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { NodeId } from "node-opcua-nodeid";
import type { Message, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import type { ActivateSessionRequest } from "node-opcua-types";
import { encodeVariant, Variant, type VariantOptions } from "node-opcua-variant";
import { OPCUAServerCore, type OPCUAServerOptions } from "../opcua_server.js";
import type { ServerEngineOptions } from "../server_engine.js";
import type { ServerSession } from "../server_session.js";
import type { RemoteEngine } from "./remote_engine.js";

function variantBytes(value: VariantOptions | Variant): Uint8Array {
    const variant = value instanceof Variant ? value : new Variant(value);
    const size = new BinaryStreamSizeCalculator();
    encodeVariant(variant, size);
    const stream = new BinaryStream(size.length);
    encodeVariant(variant, stream);
    return new Uint8Array(stream.buffer.subarray(0, size.length));
}

export class FrontOPCUAServer extends OPCUAServerCore<RemoteEngine> {
    readonly #remote: RemoteEngine;

    constructor(options: OPCUAServerOptions, engine: RemoteEngine) {
        super(options);
        this.#remote = engine;
        this.on("session_activated", (session: ServerSession) => engine.sessionActivated(session));
    }

    protected createEngine(_options: ServerEngineOptions): RemoteEngine {
        return this.#remote;
    }

    /** the address space, its role sets and its structures are the engine's */
    protected override afterEngineInitialized(): Error | null {
        return null;
    }

    /** raised on the engine's Server object, where every subscriber of every front sees it */
    public override raiseEvent(eventType: EventTypeLike | UAObjectType, options: RaiseEventData): void {
        // a name, a NodeId, or the event type node: the engine finds the type again from its name or NodeId
        const name =
            typeof eventType === "string"
                ? eventType
                : eventType instanceof NodeId
                  ? eventType.toString()
                  : eventType.nodeId.toString();
        if (!name) return;
        const fields: Record<string, Uint8Array> = {};
        for (const [field, value] of Object.entries(options)) {
            if (value === undefined || value === null) continue;
            fields[field] = variantBytes(value as VariantOptions); // check-proto-pollution: ok - names of event fields
        }
        this.#remote.raiseEvent(name, fields);
    }

    /** a session another front holds comes here first: an ActivateSession on a channel of this front */
    protected override _on_ActivateSessionRequest(message: Message, channel: ServerSecureChannelLayer): void {
        const token = (message.request as ActivateSessionRequest).requestHeader.authenticationToken;
        if (this.engine.getSession(token)) {
            super._on_ActivateSessionRequest(message, channel);
            return;
        }
        this.engine
            .takeSession(token)
            .catch(() => null)
            .then(() => super._on_ActivateSessionRequest(message, channel));
    }
}
