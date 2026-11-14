/**
 * @module node-opcua-server
 *
 * The server of a front thread: every service of an OPCUAServer, over a RemoteEngine. The front
 * listens, secures channels and encodes; the one server behind it is the engine thread's, so
 * that every front shows the same address space, sessions and diagnostics.
 */
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { encodedBodyOf, retainEncodedBodies } from "node-opcua-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import { ServiceFault } from "node-opcua-types";
import { encodeVariant, Variant } from "node-opcua-variant";
import { leanRead } from "../lean_read.js";
import { leanWrite } from "../lean_write.js";
import { OPCUAServerCore } from "../opcua_server.js";
import { EncodedResponse } from "./encoded_response.js";
import { encodeMessageBody } from "./protocol.js";
import { tokenKeyOf } from "./token_key.js";
function variantBytes(value) {
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
export class FrontOPCUAServer extends OPCUAServerCore {
    #remote;
    #workers;
    // the requests a session worker has not answered yet: Publish waits there until there is something to send
    #pending = new Map();
    #requestId = 0;
    #watchedChannels = new WeakSet();
    constructor(options, engine, workers) {
        super(options);
        // the channel keeps the bytes of the requests this front forwards to a session worker
        if (workers.length > 0)
            retainEncodedBodies(SUBSCRIPTION_SERVICES);
        this.#remote = engine;
        this.#workers = workers;
        for (const port of workers)
            port.on("message", (message) => this.#answered(message));
        this.on("session_activated", (session) => this.#announce(session));
    }
    /** the Reads of items served in place are answered from the bytes of the request */
    leanRequestHandler() {
        const remote = this.#remote;
        const backend = remote.backend;
        const host = {
            getSession: (token, activeOnly) => this.getSession(token, activeOnly),
            get maxNodesPerRead() {
                return remote.serverCapabilities.operationLimits.maxNodesPerRead ?? 0;
            },
            // the index of the node in the shared store, for the nodes read in place
            itemOf: (nodeId) => {
                const i = backend.inPlaceIndex({ nodeId, attributeId: AttributeIds.Value });
                return i < 0 ? null : i;
            },
            read: (context, items, maxAge, timestampsToReturn) => items.map((i) => backend.readAt(i, context, maxAge, timestampsToReturn))
        };
        const writeHost = {
            getSession: host.getSession,
            get maxNodesPerWrite() {
                return remote.serverCapabilities.operationLimits.maxNodesPerWrite ?? 0;
            },
            // numbers and booleans of Variables any session may write: written here, the engine told after;
            // anything else: the engine decodes and writes them, as for a Write forwarded the usual way
            write: (context, nodesToWrite, count) => {
                const forward = (bytes) => remote.writeEncoded(context, bytes);
                return backend.writeInPlace(nodesToWrite, count, forward) ?? forward(nodesToWrite);
            }
        };
        return (channel, typeId, body, offset, requestId, securityHeader) => 
        // a listener of "request" sees every request: it gets them decoded
        this.listenerCount("request") === 0 &&
            (leanRead(host, channel, typeId, body, offset, requestId, securityHeader) ||
                leanWrite(writeHost, channel, typeId, body, offset, requestId, securityHeader));
    }
    /** a session taken from another front for this ActivateSession goes back there */
    activationRefused(session) {
        return this.#remote.returnSession(session);
    }
    /** the engine records the activation (user, roles, diagnostics) before the client hears of it */
    recordActivation(session) {
        return this.#remote.sessionActivated(session);
    }
    /** the subscription services go to the session worker of the session, the others are served here */
    on_request(message, channel) {
        const request = message.request;
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
            .workerOf(tokenKeyOf(token))
            .then((worker) => {
            if (worker < 0) {
                super.on_request(message, channel);
                return;
            }
            this.#watchChannel(channel);
            const id = ++this.#requestId;
            this.#pending.set(id, { channel, message });
            const forwarded = {
                kind: "request",
                id,
                token: tokenKeyOf(token),
                channel: channel.channelId ?? 0,
                security: {
                    securityMode: channel.securityMode,
                    securityPolicy: channel.securityPolicy,
                    clientCertificate: channel.clientCertificate ? new Uint8Array(channel.clientCertificate) : null
                },
                // as the request arrived, when the channel kept it; encoded again otherwise
                request: encodedBodyOf(request) ?? encodeMessageBody(request)
            };
            this.#workers[worker].postMessage(forwarded);
        })
            .catch(() => super.on_request(message, channel));
    }
    /** the session worker learns the session as activated, before any of its subscription requests */
    #announce(session) {
        const token = tokenKeyOf(session.authenticationToken);
        const activation = this.#remote.activationOf(session);
        if (!activation)
            return;
        const record = this.#remote.recordOf(session);
        void this.#remote.workerOf(token).then((worker) => {
            if (worker < 0)
                return;
            const announced = { kind: "session", record, activation };
            this.#workers[worker].postMessage(announced);
        });
    }
    #answered(message) {
        const pending = this.#pending.get(message.id);
        if (!pending)
            return;
        this.#pending.delete(message.id);
        // sent as the worker encoded it, not decoded here
        const response = new EncodedResponse(message.response, message.name);
        pending.channel.send_response("MSG", response, pending.message);
    }
    /** a channel that closes: the session workers drop what they hold for it (its Publish requests) */
    #watchChannel(channel) {
        if (this.#watchedChannels.has(channel))
            return;
        this.#watchedChannels.add(channel);
        channel.once("close", () => {
            const closed = { kind: "channelClosed", channel: channel.channelId ?? 0 };
            for (const port of this.#workers)
                port.postMessage(closed);
            for (const [id, pending] of this.#pending) {
                if (pending.channel === channel)
                    this.#pending.delete(id);
            }
        });
    }
    createEngine(_options) {
        return this.#remote;
    }
    /** the address space, its role sets and its structures are the engine's */
    afterEngineInitialized() {
        return null;
    }
    /** raised on the engine's Server object, where every subscriber of every front sees it */
    raiseEvent(eventType, options) {
        // a name, a NodeId, or the event type node: the engine finds the type again from its name or NodeId
        const name = typeof eventType === "string"
            ? eventType
            : eventType instanceof NodeId
                ? eventType.toString()
                : eventType.nodeId.toString();
        if (!name)
            return;
        const fields = {};
        for (const [field, value] of Object.entries(options)) {
            if (value === undefined || value === null)
                continue;
            fields[field] = variantBytes(value); // check-proto-pollution: ok - names of event fields
        }
        this.#remote.raiseEvent(name, fields);
    }
    /** a session another front holds comes here first: an ActivateSession on a channel of this front */
    _on_ActivateSessionRequest(message, channel) {
        const token = message.request.requestHeader.authenticationToken;
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
//# sourceMappingURL=front_opcua_server.js.map