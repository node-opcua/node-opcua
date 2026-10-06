/**
 * @module node-opcua-server
 *
 * Server.ServerDiagnostics the same in every front thread: each front sends, once a second, the
 * diagnostics of its sessions and of their subscriptions that changed since it last did, and the
 * ids of the sessions it holds; the other fronts keep a copy of those sessions' nodes (the session
 * object under SessionsDiagnosticsSummary with its SessionDiagnostics, SessionSecurityDiagnostics
 * and SubscriptionDiagnosticsArray, and their entries in the server's diagnostics arrays).
 *
 * A second is within what these nodes promise: their MinimumSamplingInterval is two seconds. The
 * counters of a request (ReadCount, WriteCount...) stay where the session is, counted by its own
 * thread: only their values cross, once a second, for the sessions whose diagnostics moved.
 */
import {
    type AddressSpace,
    addElement,
    createExtObjArrayNode,
    ensureObjectIsSecure,
    removeElement,
    type UADynamicVariableArray,
    type UAObject,
    type UAVariable
} from "node-opcua-address-space";
import { NodeClass, QualifiedName } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { SessionDiagnosticsDataType, SessionSecurityDiagnosticsDataType, SubscriptionDiagnosticsDataType } from "node-opcua-types";
import type { ServerEngine } from "../server_engine.js";
import type { ServerSession } from "../server_session.js";
import { decodeStructure, encodeStructure } from "./protocol.js";

const warningLog = make_warningLog("front_threads_diagnostics");

/** the diagnostics of one session, as their binary encoding */
export interface SessionSnapshot {
    sessionId: string;
    browseName: string;
    diagnostics: Uint8Array;
    security: Uint8Array;
    subscriptions: Uint8Array[];
}

/** what a front sends of its sessions: those whose diagnostics changed, and the ids of all it holds */
export interface DiagnosticsUpdate {
    changed: SessionSnapshot[];
    present: string[];
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    return a.byteLength === b.byteLength && Buffer.compare(a, b) === 0;
}

function sameSnapshot(a: SessionSnapshot, b: SessionSnapshot): boolean {
    return (
        a.browseName === b.browseName &&
        sameBytes(a.diagnostics, b.diagnostics) &&
        sameBytes(a.security, b.security) &&
        a.subscriptions.length === b.subscriptions.length &&
        a.subscriptions.every((bytes, k) => sameBytes(bytes, b.subscriptions[k]))
    );
}

/** the side of the front that holds the sessions: what changed since the last update */
export class DiagnosticsPublisher {
    readonly #engine: ServerEngine;
    #sent = new Map<string, SessionSnapshot>();

    constructor(engine: ServerEngine) {
        this.#engine = engine;
    }

    /** null when nothing changed */
    public update(): DiagnosticsUpdate | null {
        const sent = new Map<string, SessionSnapshot>();
        const changed: SessionSnapshot[] = [];
        for (const session of this.#engine.getSessions()) {
            const snapshot = snapshotOf(session);
            if (!snapshot) continue;
            sent.set(snapshot.sessionId, snapshot);
            const before = this.#sent.get(snapshot.sessionId);
            if (!before || !sameSnapshot(before, snapshot)) changed.push(snapshot);
        }
        const gone = [...this.#sent.keys()].some((id) => !sent.has(id));
        this.#sent = sent;
        if (changed.length === 0 && !gone) return null;
        return { changed, present: [...sent.keys()] };
    }
}

function snapshotOf(session: ServerSession): SessionSnapshot | null {
    const diagnostics = session.sessionDiagnostics?.$extensionObject;
    const security = session.sessionSecurityDiagnostics?.$extensionObject;
    if (!diagnostics || !security || !session.sessionObject) return null;
    return {
        sessionId: session.nodeId.toString(),
        browseName: session.sessionObject.browseName.name ?? "",
        diagnostics: encodeStructure(diagnostics as unknown as SessionDiagnosticsDataType),
        security: encodeStructure(security as unknown as SessionSecurityDiagnosticsDataType),
        subscriptions: (session.publishEngine?.subscriptions ?? []).map((subscription) =>
            encodeStructure(subscription.subscriptionDiagnostics)
        )
    };
}

/** a variable whose extension object can be updated field by field, its child variables told */
interface PartiallyUpdatable {
    updateExtensionObjectPartial(partial: Record<string, unknown>): unknown;
}

function updateInPlace(variable: UAVariable, value: object): void {
    const updatable = variable as unknown as Partial<PartiallyUpdatable>;
    if (typeof updatable.updateExtensionObjectPartial === "function") {
        updatable.updateExtensionObjectPartial({ ...value } as Record<string, unknown>);
    }
}

/** the copy, in this front, of a session another front holds */
interface MirroredSession {
    object: UAObject;
    diagnostics: UAVariable;
    security: UAVariable;
    subscriptionArray: UADynamicVariableArray<SubscriptionDiagnosticsDataType>;
    /** the entries of each subscription: in the session's array and in the server's */
    subscriptions: Map<number, UAVariable[]>;
}

/** the side of the front that shows the sessions of the others */
export class DiagnosticsMirror {
    readonly #engine: ServerEngine;
    readonly #fronts = new Map<number, Map<string, MirroredSession>>();

    constructor(engine: ServerEngine) {
        this.#engine = engine;
    }

    public apply(front: number, update: DiagnosticsUpdate): void {
        const addressSpace = this.#engine.addressSpace;
        if (!addressSpace) return;
        let mirrored = this.#fronts.get(front);
        if (!mirrored) {
            mirrored = new Map();
            this.#fronts.set(front, mirrored);
        }
        for (const snapshot of update.changed) {
            try {
                const existing = mirrored.get(snapshot.sessionId);
                if (existing) this.#update(addressSpace, existing, snapshot);
                else mirrored.set(snapshot.sessionId, this.#create(addressSpace, snapshot));
            } catch (err) {
                warningLog("cannot show the session", snapshot.sessionId, "of another front:", (err as Error).message);
            }
        }
        const present = new Set(update.present);
        for (const [sessionId, session] of mirrored) {
            if (present.has(sessionId)) continue;
            this.#remove(addressSpace, sessionId, session);
            mirrored.delete(sessionId);
        }
    }

    #arrays(addressSpace: AddressSpace) {
        const serverDiagnostics = addressSpace.rootFolder.objects.server.serverDiagnostics;
        const summary = serverDiagnostics.sessionsDiagnosticsSummary;
        return {
            summary,
            sessions: summary.sessionDiagnosticsArray as unknown as UADynamicVariableArray<SessionDiagnosticsDataType>,
            security:
                summary.sessionSecurityDiagnosticsArray as unknown as UADynamicVariableArray<SessionSecurityDiagnosticsDataType>,
            subscriptions:
                serverDiagnostics.subscriptionDiagnosticsArray as unknown as UADynamicVariableArray<SubscriptionDiagnosticsDataType>
        };
    }

    #create(addressSpace: AddressSpace, snapshot: SessionSnapshot): MirroredSession {
        const arrays = this.#arrays(addressSpace);
        const objectType = addressSpace.findObjectType("SessionDiagnosticsObjectType");
        const diagnosticsType = addressSpace.findVariableType("SessionDiagnosticsVariableType");
        const securityType = addressSpace.findVariableType("SessionSecurityDiagnosticsType");
        if (!objectType || !diagnosticsType || !securityType) {
            throw new Error("the session diagnostics types are missing");
        }
        const object = addressSpace.getOwnNamespace().createNode({
            browseName: snapshot.browseName,
            componentOf: arrays.summary,
            nodeClass: NodeClass.Object,
            nodeId: resolveNodeId(snapshot.sessionId),
            references: [{ isForward: true, nodeId: objectType, referenceType: "HasTypeDefinition" }],
            typeDefinition: objectType
        }) as UAObject;

        const diagnostics = diagnosticsType.instantiate({
            browseName: new QualifiedName({ name: "SessionDiagnostics", namespaceIndex: 0 }),
            componentOf: object,
            extensionObject: decodeStructure(snapshot.diagnostics, new SessionDiagnosticsDataType()),
            minimumSamplingInterval: 2000
        }) as UAVariable;
        addElement(diagnostics.$extensionObject as SessionDiagnosticsDataType, arrays.sessions);

        const security = securityType.instantiate({
            browseName: new QualifiedName({ name: "SessionSecurityDiagnostics", namespaceIndex: 0 }),
            componentOf: object,
            extensionObject: decodeStructure(snapshot.security, new SessionSecurityDiagnosticsDataType()),
            minimumSamplingInterval: 2000
        }) as UAVariable;
        ensureObjectIsSecure(security);
        ensureObjectIsSecure(addElement(security.$extensionObject as SessionSecurityDiagnosticsDataType, arrays.security));

        const subscriptionArray = createExtObjArrayNode<SubscriptionDiagnosticsDataType>(object, {
            browseName: { namespaceIndex: 0, name: "SubscriptionDiagnosticsArray" },
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            indexPropertyName: "subscriptionId",
            minimumSamplingInterval: 2000,
            variableType: "SubscriptionDiagnosticsType"
        });
        const mirrored: MirroredSession = { object, diagnostics, security, subscriptionArray, subscriptions: new Map() };
        this.#updateSubscriptions(addressSpace, mirrored, snapshot);
        return mirrored;
    }

    #update(addressSpace: AddressSpace, mirrored: MirroredSession, snapshot: SessionSnapshot): void {
        updateInPlace(mirrored.diagnostics, decodeStructure(snapshot.diagnostics, new SessionDiagnosticsDataType()));
        updateInPlace(mirrored.security, decodeStructure(snapshot.security, new SessionSecurityDiagnosticsDataType()));
        this.#updateSubscriptions(addressSpace, mirrored, snapshot);
    }

    #updateSubscriptions(addressSpace: AddressSpace, mirrored: MirroredSession, snapshot: SessionSnapshot): void {
        const arrays = this.#arrays(addressSpace);
        const seen = new Set<number>();
        for (const bytes of snapshot.subscriptions) {
            const diagnostics = decodeStructure(bytes, new SubscriptionDiagnosticsDataType());
            seen.add(diagnostics.subscriptionId);
            const entries = mirrored.subscriptions.get(diagnostics.subscriptionId);
            if (entries) {
                for (const entry of entries) updateInPlace(entry, diagnostics);
            } else {
                mirrored.subscriptions.set(diagnostics.subscriptionId, [
                    addElement(diagnostics, mirrored.subscriptionArray),
                    addElement(diagnostics, arrays.subscriptions)
                ]);
            }
        }
        for (const subscriptionId of [...mirrored.subscriptions.keys()]) {
            if (seen.has(subscriptionId)) continue;
            this.#removeSubscription(addressSpace, mirrored, subscriptionId);
        }
    }

    #removeSubscription(addressSpace: AddressSpace, mirrored: MirroredSession, subscriptionId: number): void {
        const arrays = this.#arrays(addressSpace);
        removeElement(mirrored.subscriptionArray, (d) => d.subscriptionId === subscriptionId);
        removeElement(arrays.subscriptions, (d) => d.subscriptionId === subscriptionId);
        mirrored.subscriptions.delete(subscriptionId);
    }

    #remove(addressSpace: AddressSpace, sessionId: string, mirrored: MirroredSession): void {
        const arrays = this.#arrays(addressSpace);
        for (const subscriptionId of [...mirrored.subscriptions.keys()]) {
            this.#removeSubscription(addressSpace, mirrored, subscriptionId);
        }
        const id: NodeId = resolveNodeId(sessionId);
        removeElement(arrays.sessions, (d) => sameNodeId(d.sessionId, id));
        removeElement(arrays.security, (d) => sameNodeId(d.sessionId, id));
        addressSpace.deleteNode(mirrored.diagnostics);
        addressSpace.deleteNode(mirrored.security);
        addressSpace.deleteNode(mirrored.subscriptionArray);
        addressSpace.deleteNode(mirrored.object);
    }

    /** every mirrored session, for a front that stops */
    public clear(): void {
        const addressSpace = this.#engine.addressSpace;
        if (!addressSpace) return;
        for (const mirrored of this.#fronts.values()) {
            for (const [sessionId, session] of mirrored) this.#remove(addressSpace, sessionId, session);
        }
        this.#fronts.clear();
    }
}
