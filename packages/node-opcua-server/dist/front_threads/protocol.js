/**
 * @module node-opcua-server
 *
 * The messages between the engine thread and the front threads, and how what they carry crosses
 * a thread: OPC UA structures as their binary encoding (a structured clone would drop their
 * classes), the session as the little the engine needs of it.
 */
import { decodeExpandedNodeId, encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { DataValue, decodeDataValue, encodeDataValue, encodedDataValue } from "node-opcua-data-value";
import { decodeExtensionObject, encodeExtensionObject } from "node-opcua-extension-object";
import { getStandardDataTypeFactory } from "node-opcua-factory";
import { resolveNodeId } from "node-opcua-nodeid";
import { EventFieldList, MessageSecurityMode, MonitoredItemCreateRequest, MonitoredItemNotification, NotificationMessage } from "node-opcua-types";
import { DataType, encodedVariant, encodeVariant } from "node-opcua-variant";
export function describeContext(context) {
    if (!context?.session) {
        return { session: false, roles: [], securityMode: MessageSecurityMode.None };
    }
    return {
        session: true,
        roles: context.getCurrentUserRoles().map((role) => role.toString()),
        securityMode: context.session.channel?.securityMode ?? MessageSecurityMode.None
    };
}
// the roles of a session do not change from one request to the next: parsed once
const parsedRoles = new Map();
function roleOf(text) {
    let role = parsedRoles.get(text);
    if (role === undefined) {
        role = resolveNodeId(text);
        if (parsedRoles.size < 10000)
            parsedRoles.set(text, role);
    }
    return role;
}
/** a context with what the store's permissions and services read of it, and nothing else */
export function contextOf(descriptor) {
    if (!descriptor.session) {
        return null;
    }
    const roles = descriptor.roles.map(roleOf);
    return {
        session: { channel: { securityMode: descriptor.securityMode } },
        getCurrentUserRoles: () => roles
    };
}
/**
 * bytes of their own, of exactly this length: a slice of Buffer's shared pool would carry the
 * whole pool across the thread, since a structured clone copies the entire backing buffer
 */
function exact(stream, length) {
    const buffer = stream.buffer;
    if (buffer.byteOffset === 0 && buffer.buffer.byteLength === length) {
        // a buffer above Buffer.poolSize / 2 is not taken from the pool: it already is bytes of
        // its own, of exactly this length, and copying it would double a large value in flight
        return new Uint8Array(buffer.buffer, 0, length);
    }
    const bytes = new Uint8Array(length);
    bytes.set(buffer.subarray(0, length));
    return bytes;
}
/**
 * the buffers a message can hand over instead of having them copied: the payloads encoded for
 * it, which nothing else holds (encodeStructure / encodeDataValues return bytes of their own)
 */
export function transferablesOf(payloads) {
    const transfer = [];
    for (const payload of payloads) {
        if (payload instanceof Uint8Array && payload.byteLength >= TRANSFER_THRESHOLD) {
            transfer.push(payload.buffer);
        }
    }
    return transfer;
}
/** below this, a copy costs less than detaching the buffer */
const TRANSFER_THRESHOLD = 64 * 1024;
/**
 * a request or a response as a secure channel carries it: the NodeId of its binary encoding, then its
 * fields. What a front receives (encodedBodyOf) and sends (EncodedResponse) without decoding it again.
 */
export function encodeMessageBody(value) {
    const encoding = value.schema.encodingDefaultBinary;
    if (!encoding)
        throw new Error(`${value.schema.name} has no binary encoding`);
    const size = new BinaryStreamSizeCalculator();
    encodeExpandedNodeId(encoding, size);
    value.encode(size);
    const stream = new BinaryStream(size.length);
    encodeExpandedNodeId(encoding, stream);
    value.encode(stream);
    return exact(stream, size.length);
}
export function decodeMessageBody(bytes) {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const value = getStandardDataTypeFactory().constructObject(decodeExpandedNodeId(stream));
    value.decode(stream);
    return value;
}
/** an OPC UA structure with its type: a request or a response, decoded back into its own class */
export function encodeExtensionObjectBytes(value) {
    const size = new BinaryStreamSizeCalculator();
    encodeExtensionObject(value, size);
    const stream = new BinaryStream(size.length);
    encodeExtensionObject(value, stream);
    return exact(stream, size.length);
}
export function decodeExtensionObjectBytes(bytes) {
    return decodeExtensionObject(new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)));
}
export function encodeStructure(value) {
    const size = new BinaryStreamSizeCalculator();
    value.encode(size);
    const stream = new BinaryStream(size.length);
    value.encode(stream);
    return exact(stream, size.length);
}
export function decodeStructure(bytes, value) {
    value.decode(new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)));
    return value;
}
/**
 * structures, one after the other, with their count first: one buffer for a whole batch. A
 * message of one Uint8Array per item costs a structured clone per item, which for the 1000
 * WriteValues of a batch was the largest cost of the front.
 */
export function encodeStructures(values) {
    const size = new BinaryStreamSizeCalculator();
    size.writeUInt32(values.length);
    for (const value of values)
        value.encode(size);
    const stream = new BinaryStream(size.length);
    stream.writeUInt32(values.length);
    for (const value of values)
        value.encode(stream);
    return exact(stream, size.length);
}
/**
 * the structures of encodeStructures(). Each is decoded into an instance built with
 * Object.create(prototype): its constructor would first fill every field with a default value
 * (a NodeId, a DataValue, a Variant...) that decode() overwrites at once.
 */
export function decodeStructures(bytes, prototype) {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const count = stream.readUInt32();
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
        const value = Object.create(prototype);
        value.decode(stream);
        values[i] = value;
    }
    return values;
}
/**
 * structures of encodeStructures(), each built by its constructor before it is decoded: for those
 * whose decode() fills nested structures the constructor creates (MonitoredItemCreateRequest)
 */
export function decodeStructuresWith(bytes, make) {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const count = stream.readUInt32();
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
        const value = make();
        value.decode(stream);
        values[i] = value;
    }
    return values;
}
/**
 * DataValues, one after the other, with their count first and each one's byte length in front of
 * it: a front can then hand on the bytes of a value it does not need to look into (see
 * encodedDataValuesOf), without decoding it to find where the next one starts
 */
export function encodeDataValues(values) {
    const size = new BinaryStreamSizeCalculator();
    size.writeUInt32(values.length);
    const lengths = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
        const start = size.length;
        encodeDataValue(values[i], size);
        lengths[i] = size.length - start;
        size.writeUInt32(0);
    }
    const stream = new BinaryStream(size.length);
    stream.writeUInt32(values.length);
    for (let i = 0; i < values.length; i++) {
        stream.writeUInt32(lengths[i]);
        encodeDataValue(values[i], stream);
    }
    return exact(stream, size.length);
}
/**
 * DataValues for the monitored items of another thread: each one as its fields without the value, then
 * the encoding of its Variant, kept as it is there (EncodedVariant). A structure of a companion
 * specification then reaches the client as it was encoded, from a thread that knows nothing of its type.
 */
export function encodeMonitoredValues(values) {
    const envelopes = values.map((dataValue) => {
        const envelope = new DataValue(null);
        envelope.statusCode = dataValue.statusCode;
        envelope.sourceTimestamp = dataValue.sourceTimestamp;
        envelope.sourcePicoseconds = dataValue.sourcePicoseconds;
        envelope.serverTimestamp = dataValue.serverTimestamp;
        envelope.serverPicoseconds = dataValue.serverPicoseconds;
        return envelope;
    });
    const size = new BinaryStreamSizeCalculator();
    size.writeUInt32(values.length);
    const variantLengths = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
        encodeDataValue(envelopes[i], size);
        const start = size.length;
        const value = values[i].value;
        if (value && value.dataType !== DataType.Null)
            encodeVariant(value, size);
        variantLengths[i] = size.length - start;
        size.writeUInt32(0);
    }
    const stream = new BinaryStream(size.length);
    stream.writeUInt32(values.length);
    for (let i = 0; i < values.length; i++) {
        encodeDataValue(envelopes[i], stream);
        stream.writeUInt32(variantLengths[i]);
        if (variantLengths[i] > 0)
            encodeVariant(values[i].value, stream);
    }
    return exact(stream, size.length);
}
export function decodeMonitoredValues(bytes) {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const stream = new BinaryStream(buffer);
    const count = stream.readUInt32();
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
        const dataValue = decodeDataValue(stream);
        const length = stream.readUInt32();
        if (length > 0) {
            // a copy: the message's buffer is not kept with the value
            dataValue.value = encodedVariant(new Uint8Array(buffer.subarray(stream.length, stream.length + length)));
            stream.length += length;
        }
        values[i] = dataValue;
    }
    return values;
}
export function decodeDataValues(bytes) {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const count = stream.readUInt32();
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
        stream.readUInt32();
        values[i] = decodeDataValue(stream);
    }
    return values;
}
/**
 * the DataValues of encodeDataValues() as they are encoded: each one is decoded only if something
 * reads one of its fields, and is otherwise written into a response as these very bytes
 */
export function encodedDataValuesOf(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(0, true);
    const values = new Array(count);
    let offset = 4;
    for (let i = 0; i < count; i++) {
        const length = view.getUint32(offset, true);
        offset += 4;
        values[i] = encodedDataValue(bytes.subarray(offset, offset + length));
        offset += length;
    }
    return values;
}
/** the engine-wide counts a front reads without asking, in an Int32Array the engine alone writes */
export var EngineCount;
(function (EngineCount) {
    EngineCount[EngineCount["Sessions"] = 0] = "Sessions";
    EngineCount[EngineCount["Subscriptions"] = 1] = "Subscriptions";
    EngineCount[EngineCount["RejectedSessions"] = 2] = "RejectedSessions";
    EngineCount[EngineCount["RejectedRequests"] = 3] = "RejectedRequests";
    EngineCount[EngineCount["SessionAborts"] = 4] = "SessionAborts";
    EngineCount[EngineCount["PublishingIntervals"] = 5] = "PublishingIntervals";
    /** the ServerState of the server */
    EngineCount[EngineCount["ServerState"] = 6] = "ServerState";
    /** the last subscription id handed out: session workers take the next one with Atomics.add */
    EngineCount[EngineCount["SubscriptionId"] = 7] = "SubscriptionId";
    /** the last MonitoredItem id handed out, shared the same way: a Subscription moved to another worker keeps unique ids */
    EngineCount[EngineCount["MonitoredItemId"] = 8] = "MonitoredItemId";
    EngineCount[EngineCount["Size"] = 9] = "Size";
})(EngineCount || (EngineCount = {}));
export function encodeTransferState(state) {
    const pending = state.pendingNotifications ?? [];
    const data = pending.filter((p) => p.notification instanceof MonitoredItemNotification);
    const events = pending.filter((p) => p.notification instanceof EventFieldList);
    return {
        pendingData: encodeStructures(data.map((p) => p.notification)),
        pendingDataItems: data.map((p) => p.monitoredItemId),
        pendingEvents: encodeStructures(events.map((p) => p.notification)),
        pendingEventItems: events.map((p) => p.monitoredItemId),
        id: state.id,
        publishingInterval: state.publishingInterval,
        lifeTimeCount: state.lifeTimeCount,
        maxKeepAliveCount: state.maxKeepAliveCount,
        maxNotificationsPerPublish: state.maxNotificationsPerPublish,
        publishingEnabled: state.publishingEnabled,
        priority: state.priority,
        nextSequenceNumber: state.nextSequenceNumber,
        sentNotificationMessages: encodeStructures(state.sentNotificationMessages),
        requests: encodeStructures(state.monitoredItems.map((item) => item.request)),
        items: state.monitoredItems.map((item) => ({
            monitoredItemId: item.monitoredItemId,
            timestampsToReturn: item.timestampsToReturn,
            linkedItems: item.linkedItems
        }))
    };
}
export function decodeTransferState(transferred) {
    const requests = decodeStructuresWith(transferred.requests, () => new MonitoredItemCreateRequest());
    return {
        id: transferred.id,
        publishingInterval: transferred.publishingInterval,
        lifeTimeCount: transferred.lifeTimeCount,
        maxKeepAliveCount: transferred.maxKeepAliveCount,
        maxNotificationsPerPublish: transferred.maxNotificationsPerPublish,
        publishingEnabled: transferred.publishingEnabled,
        priority: transferred.priority,
        nextSequenceNumber: transferred.nextSequenceNumber,
        sentNotificationMessages: decodeStructuresWith(transferred.sentNotificationMessages, () => new NotificationMessage()),
        pendingNotifications: [
            ...decodeStructuresWith(transferred.pendingData, () => new MonitoredItemNotification()).map((notification, k) => ({
                monitoredItemId: transferred.pendingDataItems[k],
                notification
            })),
            ...decodeStructuresWith(transferred.pendingEvents, () => new EventFieldList()).map((notification, k) => ({
                monitoredItemId: transferred.pendingEventItems[k],
                notification
            }))
        ],
        monitoredItems: transferred.items.map((item, k) => ({
            monitoredItemId: item.monitoredItemId,
            timestampsToReturn: item.timestampsToReturn,
            linkedItems: item.linkedItems,
            request: requests[k]
        }))
    };
}
/** start (1) or stop (0) watching a node: index and generation, three numbers per operation, in order */
export const WATCH = 1;
export const UNWATCH = 0;
//# sourceMappingURL=protocol.js.map