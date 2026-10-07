/**
 * @module node-opcua-server
 *
 * The server of a front thread: every service of an OPCUAServer, over a RemoteEngine. The front
 * listens, secures channels and encodes; the one server behind it is the engine thread's, so
 * that every front shows the same address space, sessions and diagnostics.
 */

import type { MessagePort } from "node:worker_threads";
import type { EventTypeLike, RaiseEventData, UAObjectType } from "node-opcua-address-space";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import type { BaseUAObject } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import type { Message, Request, Response, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import { type ActivateSessionRequest, ServiceFault } from "node-opcua-types";
import { encodeVariant, Variant, type VariantOptions } from "node-opcua-variant";
import { OPCUAServerCore, type OPCUAServerOptions } from "../opcua_server.js";
import type { ServerEngineOptions } from "../server_engine.js";
import type { ServerSession } from "../server_session.js";
import { decodeExtensionObjectBytes, encodeExtensionObjectBytes, type FrontToWorker, type WorkerToFront } from "./protocol.js";
import type { RemoteEngine } from "./remote_engine.js";

function variantBytes(value: VariantOptions | Variant): Uint8Array {
    const variant = value instanceof Variant ? value : new Variant(value);
    const size = new BinaryStreamSizeCalculator();
    encodeVariant(variant, size);
    const stream = new BinaryStream(size.length);
    encodeVariant(variant, stream);
    return new Uint8Array(stream.buffer.subarray(0, size.length));
}

/** the services a session worker answers: the subscriptions of the session live there */
const SUBSCRIPTION_SERVICES = new Set([
    "CreateSubscriptionRequest",
    "ModifySubscriptionRequest",
    "SetPublishingModeRequest",
    "DeleteSubscriptionsRequest",
    "TransferSubscriptionsRequest",
    "CreateMonitoredItemsRequest",
    "ModifyMonitoredItemsRequest",
    "SetMonitoringModeRequest",
    "SetTriggeringRequest",
    "DeleteMonitoredItemsRequest",
    "PublishRequest",
    "RepublishRequest"
]);

export class FrontOPCUAServer extends OPCUAServerCore<RemoteEngine> {
    readonly #remote: RemoteEngine;
    readonly #workers: MessagePort[];
    // the requests a session worker has not answered yet: Publish waits there until there is something to send
    readonly #pending = new Map<number, { channel: ServerSecureChannelLayer; message: Message }>();
    #requestId = 0;
    readonly #watchedChannels = new WeakSet<ServerSecureChannelLayer>();

    constructor(options: OPCUAServerOptions, engine: RemoteEngine, workers: MessagePort[]) {
        super(options);
        this.#remote = engine;
        this.#workers = workers;
        for (const port of workers) port.on("message", (message: WorkerToFront) => this.#answered(message));
        this.on("session_activated", (session: ServerSession) => this.#announce(session));
    }

    /** the engine records the activation (user, roles, diagnostics) before the client hears of it */
    protected override recordActivation(session: ServerSession): Promise<void> | undefined {
        return this.#remote.sessionActivated(session);
    }

    /** the subscription services go to the session worker of the session, the others are served here */
    public override on_request(message: Message, channel: ServerSecureChannelLayer): void {
        const request = message.request as Request & { schema: { name: string } };
        if (this.#workers.length === 0 || !SUBSCRIPTION_SERVICES.has(request.schema.name)) {
            super.on_request(message, channel);
            return;
        }
        // the checks of any service: an active session, on the channel it was activated on; else answered here
        this.prepare(message, channel);
        if (message.session_statusCode !== StatusCodes.Good) {
            const fault = new ServiceFault({
                responseHeader: { serviceResult: message.session_statusCode ?? StatusCodes.BadInternalError }
            });
            channel.send_response("MSG", fault, message);
            return;
        }
        const token = request.requestHeader.authenticationToken;
        this.#remote
            .workerOf(token.toString())
            .then((worker) => {
                if (worker < 0) {
                    super.on_request(message, channel);
                    return;
                }
                this.#watchChannel(channel);
                const id = ++this.#requestId;
                this.#pending.set(id, { channel, message });
                const forwarded: FrontToWorker = {
                    kind: "request",
                    id,
                    token: token.toString(),
                    channel: channel.channelId ?? 0,
                    security: {
                        securityMode: channel.securityMode,
                        securityPolicy: channel.securityPolicy,
                        clientCertificate: channel.clientCertificate ? new Uint8Array(channel.clientCertificate) : null
                    },
                    request: encodeExtensionObjectBytes(request as unknown as BaseUAObject)
                };
                this.#workers[worker].postMessage(forwarded);
            })
            .catch(() => super.on_request(message, channel));
    }

    /** the session worker learns the session as activated, before any of its subscription requests */
    #announce(session: ServerSession): void {
        const token = session.authenticationToken.toString();
        const activation = this.#remote.activationOf(session);
        if (!activation) return;
        const record = this.#remote.recordOf(session);
        void this.#remote.workerOf(token).then((worker) => {
            if (worker < 0) return;
            const announced: FrontToWorker = { kind: "session", record, activation };
            this.#workers[worker].postMessage(announced);
        });
    }

    #answered(message: WorkerToFront): void {
        const pending = this.#pending.get(message.id);
        if (!pending) return;
        this.#pending.delete(message.id);
        const response = decodeExtensionObjectBytes<Response>(message.response);
        pending.channel.send_response("MSG", response, pending.message);
    }

    /** a channel that closes: the session workers drop what they hold for it (its Publish requests) */
    #watchChannel(channel: ServerSecureChannelLayer): void {
        if (this.#watchedChannels.has(channel)) return;
        this.#watchedChannels.add(channel);
        channel.once("close", () => {
            const closed: FrontToWorker = { kind: "channelClosed", channel: channel.channelId ?? 0 };
            for (const port of this.#workers) port.postMessage(closed);
            for (const [id, pending] of this.#pending) {
                if (pending.channel === channel) this.#pending.delete(id);
            }
        });
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
            .takeSession(token, this)
            .catch(() => null)
            .then(() => super._on_ActivateSessionRequest(message, channel));
    }
}
