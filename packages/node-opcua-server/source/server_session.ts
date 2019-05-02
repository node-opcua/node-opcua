/**
 * @module node-opcua-server
 */
// tslint:disable:no-console

import * as crypto from "crypto";
import { EventEmitter } from "events";
import * as _ from "underscore";

import {
    addElement,
    AddressSpace,
    createExtObjArrayNode, ISessionBase, removeElement, UADynamicVariableArray,
    UAObject,
    UASessionDiagnostics
} from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { randomGuid } from "node-opcua-basic-types";
import {
    SessionDiagnosticsDataType,
    SubscriptionDiagnosticsDataType
} from "node-opcua-common";
import { QualifiedName } from "node-opcua-data-model";
import { NodeClass } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { makeNodeId, NodeId, NodeIdType, sameNodeId } from "node-opcua-nodeid";
import {  ObjectRegistry } from "node-opcua-object-registry";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { WatchDog } from "node-opcua-utils";
import { lowerFirstLetter } from "node-opcua-utils";

import { ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { ApplicationDescription, UserIdentityToken } from "node-opcua-types";

import { ISubscriber, IWatchdogData2 } from "node-opcua-utils";
import { ContinuationPointManager } from "./continuation_point_manager";
import { ServerSidePublishEngine } from "./server_publish_engine";
import { Subscription } from "./server_subscription";
import { SubscriptionState } from "./server_subscription";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const theWatchDog = new WatchDog();

const registeredNodeNameSpace = 9999;

function compareSessionId(
  sessionDiagnostics1: SessionDiagnosticsDataType,
  sessionDiagnostics2: SessionDiagnosticsDataType
) {
    return sessionDiagnostics1.sessionId.toString() === sessionDiagnostics2.sessionId.toString();
}

function on_channel_abort(this: ServerSession) {
    debugLog("ON CHANNEL ABORT ON  SESSION!!!");
    /**
     * @event channel_aborted
     */
    this.emit("channel_aborted");
}

/**
 *
 * A Server session object.
 *
 * **from OPCUA Spec 1.02:**
 *
 * * Sessions are created to be independent of the underlying communications connection. Therefore, if a communication
 *   connection fails, the Session is not immediately affected. The exact mechanism to recover from an underlying
 *   communication connection error depends on the SecureChannel mapping as described in Part 6.
 *
 * * Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
 *   within the timeout period negotiated by the Server in the CreateSession Service response. This protects the Server
 *   against Client failures and against situations where a failed underlying connection cannot be re-established.
 *
 * * Clients shall be prepared to submit requests in a timely manner to prevent the Session from closing automatically.
 *
 * * Clients may explicitly terminate Sessions using the CloseSession Service.
 *
 * * When a Session is terminated, all outstanding requests on the Session are aborted and BadSessionClosed StatusCodes
 *   are returned to the Client. In addition, the Server deletes the entry for the Client from its
 *   SessionDiagnosticsArray Variable and notifies any other Clients who were subscribed to this entry.
 *
 */
export class ServerSession  extends EventEmitter implements ISubscriber , ISessionBase {

    public static registry = new ObjectRegistry();
    public static maxPublishRequestInQueue: number = 100;

    public __status: string = "";
    public parent: any;
    public authenticationToken: NodeId;
    public nodeId: NodeId;
    public sessionName: string = "";

    public publishEngine: ServerSidePublishEngine;
    public sessionObject: any;
    public creationDate: Date;
    public sessionTimeout: number;
    public sessionDiagnostics?: UASessionDiagnostics;
    public subscriptionDiagnosticsArray?: UADynamicVariableArray<SubscriptionDiagnosticsDataType>;
    public channel?: ServerSecureChannelLayer;
    public nonce?: Buffer;
    public userIdentityToken?: UserIdentityToken;
    public clientDescription?: ApplicationDescription;
    public channelId?: number | null;
    public continuationPointManager: ContinuationPointManager;

    // ISubscriber
    public _watchDog?: WatchDog;
    public _watchDogData?: IWatchdogData2;

    private _registeredNodesCounter: number;
    private _registeredNodes: any;
    private _registeredNodesInv: any;
    private _cumulatedSubscriptionCount: number;
    private _sessionDiagnostics: any;
    private channel_abort_event_handler: any;

    constructor(parent: any, sessionTimeout: number) {

        super();

        this.parent = parent; // SessionEngine

        ServerSession.registry.register(this);

        assert(_.isFinite(sessionTimeout));
        assert(sessionTimeout >= 0, " sessionTimeout");
        this.sessionTimeout = sessionTimeout;

        const authenticationTokenBuf = crypto.randomBytes(16);
        this.authenticationToken = new NodeId(NodeIdType.BYTESTRING, authenticationTokenBuf);

        // the sessionId
        const ownNamespaceIndex = 1; // addressSpace.getOwnNamespace().index;
        this.nodeId = new NodeId(NodeIdType.GUID, randomGuid(), ownNamespaceIndex);

        assert(this.authenticationToken instanceof NodeId);
        assert(this.nodeId instanceof NodeId);

        this._cumulatedSubscriptionCount = 0;

        this.publishEngine = new ServerSidePublishEngine({
            maxPublishRequestInQueue: ServerSession.maxPublishRequestInQueue
        });

        this.publishEngine.setMaxListeners(100);

        theWatchDog.addSubscriber(this, this.sessionTimeout);

        this.__status = "new";

        /**
         * the continuation point manager for this session
         * @property continuationPointManager
         * @type {ContinuationPointManager}
         */
        this.continuationPointManager = new ContinuationPointManager();

        /**
         * @property creationDate
         * @type {Date}
         */
        this.creationDate = new Date();

        this._registeredNodesCounter = 0;
        this._registeredNodes = {};
        this._registeredNodesInv = {};
    }

    public dispose() {

        debugLog("ServerSession#dispose()");

        assert(!this.sessionObject, " sessionObject has not been cleared !");

        this.parent = null;
        this.authenticationToken = NodeId.nullNodeId;

        if (this.publishEngine) {
            this.publishEngine.dispose();
            (this as any).publishEngine = null;
        }

        this._sessionDiagnostics = null;

        this._registeredNodesCounter = 0;
        this._registeredNodes = null;
        this._registeredNodesInv = null;
        (this as any).continuationPointManager = null;
        this.removeAllListeners();
        this.__status = "disposed";

        ServerSession.registry.unregister(this);

    }

    public get clientConnectionTime() {
        return this.creationDate;
    }

    public get clientLastContactTime() {
        return this._watchDogData!.lastSeen;
    }

    public get status(): string {
        return this.__status;
    }

    public set status(value: string) {
        if (value === "active") {
            this._createSessionObjectInAddressSpace();
        }
        this.__status = value;
    }

    get addressSpace(): AddressSpace {
        return this.parent ? this.parent.addressSpace : null;
    }

    get currentPublishRequestInQueue(): number {
        return this.publishEngine
          ? this.publishEngine.pendingPublishRequestCount : 0;
    }

    public updateClientLastContactTime(currentTime: Date) {
        const session = this;
        if (session._sessionDiagnostics && session._sessionDiagnostics.clientLastContactTime) {
            currentTime = currentTime || new Date();
            // do not record all ticks as this may be overwhelming,
            if (currentTime.getTime() - 250 >= session._sessionDiagnostics.clientLastContactTime.getTime()) {
                session._sessionDiagnostics.clientLastContactTime = currentTime;
            }
        }
    }

    /**
     * @method onClientSeen
     * required for watch dog
     * @param currentTime {DateTime}
     * @private
     */
    public onClientSeen(currentTime: Date) {

        this.updateClientLastContactTime(currentTime);

        if (this._sessionDiagnostics) {
            // see https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
            assert(this._sessionDiagnostics.hasOwnProperty("currentMonitoredItemsCount"));
            assert(this._sessionDiagnostics.hasOwnProperty("currentSubscriptionsCount"));
            assert(this._sessionDiagnostics.hasOwnProperty("currentPublishRequestsInQueue"));

            // note : https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
            // sessionDiagnostics extension object uses a different spelling
            // here with an S !!!!
            this._sessionDiagnostics.currentMonitoredItemsCount = this.currentMonitoredItemCount;
            this._sessionDiagnostics.currentSubscriptionsCount = this.currentSubscriptionCount;
            this._sessionDiagnostics.currentPublishRequestsInQueue = this.currentPublishRequestInQueue;
        }
    }

    public incrementTotalRequestCount() {

        if (this._sessionDiagnostics && this._sessionDiagnostics.totalRequestCount) {
            this._sessionDiagnostics.totalRequestCount.totalCount += 1;
        }
    }

    public incrementRequestTotalCounter(counterName: string) {
        if (this._sessionDiagnostics) {
            const propName = lowerFirstLetter(counterName + "Count");
            if (!this._sessionDiagnostics.hasOwnProperty(propName)) {
                console.log(" cannot find", propName);
                // xx return;
            }
            //   console.log(self._sessionDiagnostics.toString());
            this._sessionDiagnostics[propName].totalCount = this._sessionDiagnostics[propName].totalCount + 1;
        }
    }

    public incrementRequestErrorCounter(counterName: string) {
        if (this._sessionDiagnostics) {
            const propName = lowerFirstLetter(counterName + "Count");
            if (!this._sessionDiagnostics.hasOwnProperty(propName)) {
                console.log(" cannot find", propName);
                // xx  return;
            }
            this._sessionDiagnostics[propName].errorCount += 1;
        }
    }

    /**
     * return rootFolder.objects.server.serverDiagnostics.sessionsDiagnosticsSummary
     */
    public getSessionDiagnosticsArray(): UADynamicVariableArray<SessionDiagnosticsDataType> {
        const server = this.addressSpace.rootFolder.objects.server;
        return server.serverDiagnostics.sessionsDiagnosticsSummary.sessionDiagnosticsArray;
    }

    /**
     * number of active subscriptions
     */
    public get currentSubscriptionCount(): number {
        return this.publishEngine ? this.publishEngine.subscriptionCount : 0;
    }

    /**
     * number of subscriptions ever created since this object is live
     */
    public get cumulatedSubscriptionCount(): number {
        return this._cumulatedSubscriptionCount;
    }

    /**
     * number of monitored items
     */
    public get currentMonitoredItemCount(): number {
        const self = this;
        return self.publishEngine ? self.publishEngine.currentMonitoredItemCount : 0;
    }

    /**
     * retrieve an existing subscription by subscriptionId
     * @method getSubscription
     * @param subscriptionId {Number}
     * @return {Subscription}
     */
    public getSubscription(subscriptionId: number): Subscription | null {
        const subscription = this.publishEngine.getSubscriptionById(subscriptionId);
        if (subscription && subscription.state === SubscriptionState.CLOSED) {
            // subscription is CLOSED but has not been notified yet
            // it should be considered as excluded
            return null;
        }
        assert(!subscription || subscription.state !== SubscriptionState.CLOSED,
          "CLOSED subscription shall not be managed by publish engine anymore");
        return subscription;
    }

    /**
     * @method deleteSubscription
     * @param subscriptionId {Number}
     * @return {StatusCode}
     */
    public deleteSubscription(subscriptionId: number): StatusCode {

        const session = this;
        const subscription = session.getSubscription(subscriptionId);
        if (!subscription) {
            return StatusCodes.BadSubscriptionIdInvalid;
        }

        // xx this.publishEngine.remove_subscription(subscription);
        subscription.terminate();

        if (session.currentSubscriptionCount === 0) {

            const local_publishEngine = session.publishEngine;
            local_publishEngine.cancelPendingPublishRequest();
        }
        return StatusCodes.Good;
    }

    /**
     * close a ServerSession, this will also delete the subscriptions if the flag is set.
     *
     * Spec extract:
     *
     * If a Client invokes the CloseSession Service then all Subscriptions associated with the Session are also deleted
     * if the deleteSubscriptions flag is set to TRUE. If a Server terminates a Session for any other reason,
     * Subscriptions associated with the Session, are not deleted. Each Subscription has its own lifetime to protect
     * against data loss in the case of a Session termination. In these cases, the Subscription can be reassigned to
     * another Client before its lifetime expires.
     *
     * @method close
     * @param deleteSubscriptions : should we delete subscription ?
     * @param [reason = "CloseSession"] the reason for closing the session
     *         (shall be "Timeout", "Terminated" or "CloseSession")
     *
     */
    public close(deleteSubscriptions: boolean, reason: string) {

        debugLog(" closing session deleteSubscriptions = ", deleteSubscriptions)
        if (this.publishEngine) {
            this.publishEngine.onSessionClose();
        }

        theWatchDog.removeSubscriber(this);
        // ---------------  delete associated subscriptions ---------------------

        if (!deleteSubscriptions && this.currentSubscriptionCount !== 0) {

            // I don't know what to do yet if deleteSubscriptions is false
            console.log("TO DO : Closing session without deleting subscription not yet implemented");
            // to do: Put subscriptions in safe place for future transfer if any

        }

        this._deleteSubscriptions();

        assert(this.currentSubscriptionCount === 0);

        // Post-Conditions
        assert(this.currentSubscriptionCount === 0);

        this.status = "closed";
        /**
         * @event session_closed
         * @param deleteSubscriptions {Boolean}
         * @param reason {String}
         */
        this.emit("session_closed", this, deleteSubscriptions, reason);

        // ---------------- shut down publish engine
        if (this.publishEngine) {

            // remove subscription
            this.publishEngine.shutdown();

            assert(this.publishEngine.subscriptionCount === 0);
            this.publishEngine.dispose();
            this.publishEngine = null as any as ServerSidePublishEngine;
        }

        this._removeSessionObjectFromAddressSpace();

        assert(!this.sessionDiagnostics, "ServerSession#_removeSessionObjectFromAddressSpace must be called");
        assert(!this.sessionObject, "ServerSession#_removeSessionObjectFromAddressSpace must be called");

    }

    public registerNode(nodeId: NodeId) {
        assert(nodeId instanceof NodeId);
        const session = this;

        if (nodeId.namespace === 0 && nodeId.identifierType === NodeIdType.NUMERIC) {
            return nodeId;
        }

        const key = nodeId.toString();

        const registeredNode = session._registeredNodes[key];
        if (registeredNode) {
            // already registered
            return registeredNode;
        }

        const node = session.addressSpace.findNode(nodeId);
        if (!node) {
            return nodeId;
        }

        session._registeredNodesCounter += 1;

        const aliasNodeId = makeNodeId(session._registeredNodesCounter, registeredNodeNameSpace);
        session._registeredNodes[key] = aliasNodeId;
        session._registeredNodesInv[aliasNodeId.toString()] = node;
        return aliasNodeId;
    }

    public unRegisterNode(aliasNodeId: NodeId): void {

        assert(aliasNodeId instanceof NodeId);
        if (aliasNodeId.namespace !== registeredNodeNameSpace) {
            return; // not a registered Node
        }
        const session = this;

        const node = session._registeredNodesInv[aliasNodeId.toString()];
        if (!node) {
            return;
        }
        session._registeredNodesInv[aliasNodeId.toString()] = null;
        session._registeredNodes[node.nodeId.toString()] = null;
    }

    public resolveRegisteredNode(aliasNodeId: NodeId): NodeId {

        if (aliasNodeId.namespace !== registeredNodeNameSpace) {
            return aliasNodeId; // not a registered Node
        }
        const node = this._registeredNodesInv[aliasNodeId.toString()];
        if (!node) {
            return aliasNodeId;
        }
        return node.nodeId;
    }

    /**
     * true if the underlying channel has been closed or aborted...
     */
    public get aborted() {
        if (!this.channel) {
            return true;
        }
        return this.channel.aborted;
    }

    public createSubscription(parameters: any): Subscription {
        const subscription = this.parent._createSubscriptionOnSession(this, parameters);
        this.assignSubscription(subscription);
        assert(subscription.$session === this);
        assert(subscription.sessionId instanceof NodeId);
        assert(sameNodeId(subscription.sessionId, this.nodeId));
        return subscription;
    }

    public _attach_channel(channel: ServerSecureChannelLayer) {
        assert(this.nonce && this.nonce instanceof Buffer);
        this.channel = channel;
        this.channelId = channel.channelId;
        const key = this.authenticationToken.toString();
        assert(!channel.sessionTokens.hasOwnProperty(key), "channel has already a session");

        channel.sessionTokens[key] = this;

        // when channel is aborting
        this.channel_abort_event_handler = on_channel_abort.bind(this);
        channel.on("abort", this.channel_abort_event_handler);

    }

    public _detach_channel() {
        const channel = this.channel;
        if (!channel) {
            throw new Error("expecting a valid channel");
        }
        assert(this.nonce && this.nonce instanceof Buffer);
        assert(this.authenticationToken);
        const key = this.authenticationToken.toString();
        assert(channel.sessionTokens.hasOwnProperty(key));
        assert(this.channel);
        assert(_.isFunction(this.channel_abort_event_handler));
        channel.removeListener("abort", this.channel_abort_event_handler);

        delete channel.sessionTokens[key];
        this.channel = undefined;
        this.channelId = undefined;
    }

    public  _exposeSubscriptionDiagnostics(subscription: Subscription) {
        debugLog("ServerSession#_exposeSubscriptionDiagnostics");
        assert(subscription.$session === this);
        const subscriptionDiagnosticsArray = this._getSubscriptionDiagnosticsArray();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert(subscriptionDiagnostics.$subscription === subscription);

        if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
            // xx console.log("GG => ServerSession Exposing subscription diagnostics =>",
            // subscription.id,"on session", session.nodeId.toString());
            addElement(subscriptionDiagnostics, subscriptionDiagnosticsArray);
        }
    }

    public _unexposeSubscriptionDiagnostics(subscription: Subscription) {

        const subscriptionDiagnosticsArray = this._getSubscriptionDiagnosticsArray();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert(subscriptionDiagnostics instanceof SubscriptionDiagnosticsDataType);
        if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
            // console.log("GG => ServerSession **Unexposing** subscription diagnostics =>",
            // subscription.id,"on session", session.nodeId.toString());
            removeElement(subscriptionDiagnosticsArray, subscriptionDiagnostics);
        }
        debugLog("ServerSession#_unexposeSubscriptionDiagnostics");
    }
    /**
     * @method watchdogReset
     * used as a callback for the Watchdog
     * @private
     */
    public watchdogReset() {
        const self = this;
        // the server session has expired and must be removed from the server
        self.emit("timeout");
    }

    private _createSessionObjectInAddressSpace() {

        if (this.sessionObject) {
            return;
        }
        assert(!this.sessionObject, "ServerSession#_createSessionObjectInAddressSpace already called ?");

        this.sessionObject = null;
        if (!this.addressSpace) {
            debugLog("ServerSession#_createSessionObjectInAddressSpace : no addressSpace");
            return; // no addressSpace
        }
        const root = this.addressSpace.rootFolder;
        assert(root, "expecting a root object");

        if (!root.objects) {
            debugLog("ServerSession#_createSessionObjectInAddressSpace : no object folder");
            return false;
        }
        if (!root.objects.server) {
            debugLog("ServerSession#_createSessionObjectInAddressSpace : no server object");
            return false;
        }

        // self.addressSpace.findNode(makeNodeId(ObjectIds.Server_ServerDiagnostics));
        const serverDiagnosticsNode = root.objects.server.serverDiagnostics;

        if (!serverDiagnosticsNode || !serverDiagnosticsNode.sessionsDiagnosticsSummary) {
            debugLog(
              "ServerSession#_createSessionObjectInAddressSpace :" +
              " no serverDiagnostics.sessionsDiagnosticsSummary");
            return false;
        }

        const sessionDiagnosticsDataType = this.addressSpace.findDataType("SessionDiagnosticsDataType");

        const sessionDiagnosticsObjectType = this.addressSpace.findObjectType("SessionDiagnosticsObjectType");
        const sessionDiagnosticsVariableType = this.addressSpace.findVariableType("SessionDiagnosticsVariableType");

        const references = [];
        if (sessionDiagnosticsObjectType) {
            references.push({
                isForward: true,
                nodeId: sessionDiagnosticsObjectType,
                referenceType: "HasTypeDefinition",
            });
        }

        const namespace = this.addressSpace.getOwnNamespace();
        this.sessionObject = namespace.createNode({
            browseName: this.sessionName || "Session-" + this.nodeId.toString(),
            componentOf: serverDiagnosticsNode.sessionsDiagnosticsSummary,
            nodeClass: NodeClass.Object,
            nodeId: this.nodeId,
            references,
            typeDefinition: sessionDiagnosticsObjectType,
        }) as UAObject;

        if (sessionDiagnosticsDataType && sessionDiagnosticsVariableType) {

            // the extension object
            this._sessionDiagnostics = this.addressSpace.constructExtensionObject(sessionDiagnosticsDataType, {});
            this._sessionDiagnostics.session = this;

            // install property getter on property that are unlikely to change
            if (this.parent.clientDescription) {
                this._sessionDiagnostics.clientDescription = this.parent.clientDescription;
            }

            Object.defineProperty(this._sessionDiagnostics, "clientConnectionTime", {
                get(this: any) {
                    return this.session.clientConnectionTime;
                }
            });

            Object.defineProperty(this._sessionDiagnostics, "actualSessionTimeout", {
                get(this: any) {
                    return this.session.sessionTimeout;
                }
            });

            Object.defineProperty(this._sessionDiagnostics, "sessionId", {
                get(this: any) {
                    return this.session.nodeId;
                }
            });

            Object.defineProperty(this._sessionDiagnostics, "sessionName", {
                get(this: any) {
                    return this.session.sessionName.toString();
                }
            });

            this.sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
                browseName: new QualifiedName({ name: "SessionDiagnostics", namespaceIndex: 0 }),
                componentOf: this.sessionObject,
                extensionObject: this._sessionDiagnostics,
                minimumSamplingInterval: 2000 // 2 seconds
            }) as UASessionDiagnostics;

            this._sessionDiagnostics = this.sessionDiagnostics.$extensionObject;
            assert(this._sessionDiagnostics.session === this);

            const sessionDiagnosticsArray = this.getSessionDiagnosticsArray();

            // add sessionDiagnostics into sessionDiagnoticsArray
            addElement<SessionDiagnosticsDataType>(this._sessionDiagnostics, sessionDiagnosticsArray);

        }

        const subscriptionDiagnosticsArrayType =
          this.addressSpace.findVariableType("SubscriptionDiagnosticsArrayType")!;
        assert(subscriptionDiagnosticsArrayType.nodeId.toString() === "ns=0;i=2171");

        this.subscriptionDiagnosticsArray =
          createExtObjArrayNode<SubscriptionDiagnosticsDataType>(this.sessionObject, {
              browseName: { namespaceIndex: 0, name: "SubscriptionDiagnosticsArray" },
              complexVariableType: "SubscriptionDiagnosticsArrayType",
              indexPropertyName: "subscriptionId",
              minimumSamplingInterval: 2000, // 2 seconds
              variableType: "SubscriptionDiagnosticsType",
          });

        return this.sessionObject;
    }

    /**
     *
     * @private
     */
    private _removeSessionObjectFromAddressSpace() {

        // todo : dump session statistics in a file or somewhere for deeper diagnostic analysis on closed session

        if (!this.addressSpace) {
            return;
        }
        if (this.sessionDiagnostics) {

            const sessionDiagnosticsArray = this.getSessionDiagnosticsArray()!;
            removeElement(sessionDiagnosticsArray, this.sessionDiagnostics.$extensionObject);

            this.addressSpace.deleteNode(this.sessionDiagnostics);

            assert(this._sessionDiagnostics.session === this);
            this._sessionDiagnostics.session = null;

            this._sessionDiagnostics = null;
            this.sessionDiagnostics = undefined;

        }
        if (this.sessionObject) {
            this.addressSpace.deleteNode(this.sessionObject);
            this.sessionObject = null;
        }
    }

    /**
     *
     * @private
     */
    private _getSubscriptionDiagnosticsArray() {

        if (!this.addressSpace) {
            if (doDebug) {
                console.warn("ServerSession#_getSubscriptionDiagnosticsArray : no addressSpace");
            }
            return null; // no addressSpace
        }

        const subscriptionDiagnosticsArray = this.subscriptionDiagnosticsArray;
        if (!subscriptionDiagnosticsArray) {
            return null; // no subscriptionDiagnosticsArray
        }
        assert(subscriptionDiagnosticsArray.browseName.toString() === "SubscriptionDiagnosticsArray");
        return subscriptionDiagnosticsArray;
    }

    private assignSubscription(subscription: Subscription) {
        assert(!subscription.$session);
        assert(this.nodeId instanceof NodeId);

        subscription.$session = this;

        subscription.sessionId = this.nodeId;

        this._cumulatedSubscriptionCount += 1;

        // Notify the owner that a new subscription has been created
        // @event new_subscription
        // @param {Subscription} subscription
        this.emit("new_subscription", subscription);

        // add subscription diagnostics to SubscriptionDiagnosticsArray
        this._exposeSubscriptionDiagnostics(subscription);

        subscription.once("terminated", () => {
            // Xx session._unexposeSubscriptionDiagnostics(subscription);
            // Notify the owner that a new subscription has been terminated
            // @event subscription_terminated
            // @param {Subscription} subscription
            this.emit("subscription_terminated", subscription);
        });

    }

    private _deleteSubscriptions() {
        assert(this.publishEngine);
        const subscriptions = this.publishEngine.subscriptions;
        subscriptions.forEach((subscription: Subscription) => {
            this.deleteSubscription(subscription.id);
        });
    }

}
