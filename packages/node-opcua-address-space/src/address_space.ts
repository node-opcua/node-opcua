/**
 * @module node-opcua-address-space
 */

import * as chalk from "chalk";
import { randomBytes } from "crypto";

import { assert } from "node-opcua-assert";
import { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { DataTypeIds, VariableTypeIds } from "node-opcua-constants";
import { BrowseDirection, NodeClass, QualifiedName } from "node-opcua-data-model";
import { ExtensionObject } from "node-opcua-extension-object";
import { coerceExpandedNodeId, makeNodeId, NodeId, NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import { BrowseResult } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import {
    BrowseDescription,
    BrowsePath,
    BrowsePathResult,
    BrowsePathTargetOptions,
    BrowseResultOptions,
    RelativePathElement
} from "node-opcua-types";
import * as utils from "node-opcua-utils";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant, VariantT } from "node-opcua-variant";
import {
    AddReferenceOpts,
    AddressSpace as AddressSpacePublic,
    adjustBrowseDirection,
    IEventData,
    IHistoricalDataNodeOptions,
    RootFolder,
    SessionContext,
    UAEventType,
    UAEventType as UAEventTypePublic,
    UAObjectType as UAObjectTypePublic,
    UAReference,
    UAReferenceType as UAReferenceTypePublic,
    UAVariableType as UAVariableTypePublic
} from "../source";
import { AddressSpacePrivate } from "./address_space_private";
import { UAAcknowledgeableConditionBase } from "./alarms_and_conditions";
import { UAConditionBase } from "./alarms_and_conditions";
import { BaseNode } from "./base_node";
import { EventData } from "./event_data";
import { AddressSpace_installHistoricalDataNode } from "./historical_access/address_space_historical_data_node";
import { UANamespace } from "./namespace";
import { isNonEmptyQualifiedName } from "./namespace";
import { NamespacePrivate } from "./namespace_private";
import { Reference } from "./reference";
import { UADataType, ExtensionObjectConstructorFuncWithSchema } from "./ua_data_type";
import { UAMethod } from "./ua_method";
import { UAObject } from "./ua_object";
import { UAObjectType } from "./ua_object_type";
import { UAReferenceType } from "./ua_reference_type";
import { UAVariable } from "./ua_variable";
import { UAVariableType } from "./ua_variable_type";
import { UAView } from "./ua_view";

const doDebug = false;
// tslint:disable-next-line:no-var-requires
const Dequeue = require("dequeue");

const regexNumberColumnString = /^([0-9]+):(.*)/;

function _extract_namespace_and_browse_name_as_string(
    addressSpace: AddressSpace,
    browseName: NodeIdLike | QualifiedName,
    namespaceIndex?: number
): [NamespacePrivate, string] {
    assert(!namespaceIndex || namespaceIndex >= 0);

    let result;

    if (namespaceIndex !== undefined && namespaceIndex > 0) {
        assert(typeof browseName === "string", "expecting a string when namespaceIndex is specified");
        result = [addressSpace.getNamespace(namespaceIndex), browseName];
    } else if (typeof browseName === "string") {
        // split
        if (browseName.indexOf(":") >= 0) {
            const a = browseName.split(":");
            namespaceIndex = a.length === 2 ? parseInt(a[0], 10) : namespaceIndex;
            browseName = a.length === 2 ? a[1] : browseName;
        }
        result = [addressSpace.getNamespace(namespaceIndex || 0), browseName];
    } else if (browseName instanceof QualifiedName) {
        namespaceIndex = browseName.namespaceIndex;
        result = [addressSpace.getNamespace(namespaceIndex), browseName.name];
    } else if (typeof browseName === "number") {
        result = [addressSpace.getDefaultNamespace(), DataType[browseName]];
    }

    /* istanbul ignore next */
    if (!result || !result[0]) {
        throw new Error(` Cannot find namespace associated with ${browseName} ${namespaceIndex}`);
    }
    return result as [NamespacePrivate, string];
}

/**
 * returns true if str matches a nodeID, e.g i=123 or ns=...
 * @method isNodeIdString
 * @param str
 * @type {boolean}
 */
function isNodeIdString(str: any) {
    if (typeof str !== "string") {
        return false;
    }
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}

type ShutdownTask = (this: AddressSpace) => void;

/**
 * `AddressSpace` is a collection of UA nodes.
 *
 *     const addressSpace = AddressSpace.create();
 */
export class AddressSpace implements AddressSpacePrivate {
    public get rootFolder(): RootFolder {
        const rootFolder = this.findNode(this.resolveNodeId("RootFolder"));
        if (!rootFolder) {
            // throw new Error("AddressSpace doesn't contain rootFolder object");
            return (null as unknown) as RootFolder;
        }
        return (rootFolder as unknown) as RootFolder;
    }

    public static isNonEmptyQualifiedName = isNonEmptyQualifiedName;
    public static historizerFactory?: any;

    public static create(): AddressSpacePublic {
        return new AddressSpace();
    }

    private static registry = new ObjectRegistry();

    /***
     * @internal
     * @private
     */
    public suspendBackReference: boolean = false;
    public isFrugal: boolean = false;
    public historizingNodes?: { [key: string]: UAVariable } = {};
    public _condition_refresh_in_progress: boolean = false;

    public readonly isNodeIdString = isNodeIdString;
    private readonly _private_namespaceIndex: number;
    private readonly _namespaceArray: NamespacePrivate[];
    private _shutdownTask: ShutdownTask[] = [];
    private _modelChangeTransactionCounter: number = 0;
    private _modelChanges: any[] = [];

    constructor() {
        this._private_namespaceIndex = 1;
        this._namespaceArray = [];
        this._constructNamespaceArray();
        AddressSpace.registry.register(this);
    }
    /**
     * @internal
     */
    public getDataTypeManager(): ExtraDataTypeManager {
        const addressSpacePriv: any = this as any;
        assert(
            addressSpacePriv.$$extraDataTypeManager,
            "expecting a $$extraDataTypeManager please make sure ensureDatatypeExtracted is called"
        );
        return addressSpacePriv.$$extraDataTypeManager;
    }

    public getNamespaceUri(namespaceIndex: number): string {
        assert(namespaceIndex >= 0 && namespaceIndex < this._namespaceArray.length);
        return this._namespaceArray[namespaceIndex].namespaceUri;
    }

    /***
     * @method getNamespace
     * @param {string|number} namespace index or namespace uri.
     * @return {NameSpace} the namespace
     */
    public getNamespace(namespaceIndexOrName: string | number): NamespacePrivate {
        if (typeof namespaceIndexOrName === "number") {
            const namespaceIndex = namespaceIndexOrName;
            assert(namespaceIndex >= 0 && namespaceIndex < this._namespaceArray.length, "invalid namespace index ( out of bound)");
            return this._namespaceArray[namespaceIndex];
        } else {
            const namespaceUri = namespaceIndexOrName;
            assert(typeof namespaceUri === "string");
            const index = this.getNamespaceIndex(namespaceUri);
            return this._namespaceArray[index];
        }
    }

    /***
     * @method getDefaultNamespace
     * @return  the  default namespace (standard OPCUA namespace)
     */
    public getDefaultNamespace(): NamespacePrivate {
        return this.getNamespace(0);
    }

    /***
     * @method getOwnNamespace
     *
     * objects instances managed by the server will be created in this namespace.
     *
     * @return  address space own namespace
     */
    public getOwnNamespace(): NamespacePrivate {
        /* istanbul ignore next */
        if (this._private_namespaceIndex >= this._namespaceArray.length) {
            throw new Error("please create the private namespace");
        }
        return this.getNamespace(this._private_namespaceIndex);
    }

    /**
     * @method getNamespaceIndex
     * @param namespaceUri
     * @return the namespace index of a namespace given by its namespace uri
     *
     */
    public getNamespaceIndex(namespaceUri: string): number {
        assert(typeof namespaceUri === "string");
        return this._namespaceArray.findIndex((ns: NamespacePrivate) => ns.namespaceUri === namespaceUri);
    }

    /**
     * @method registerNamespace
     *
     * register a new namespace
     *
     * @param namespaceUri {string}
     * @returns {Namespace}
     */
    public registerNamespace(namespaceUri: string) {
        let index = this._namespaceArray.findIndex((ns) => ns.namespaceUri === namespaceUri);
        if (index !== -1) {
            assert((this._namespaceArray[index].addressSpace as any) === (this as any));
            return this._namespaceArray[index];
        }
        index = this._namespaceArray.length;
        this._namespaceArray.push(
            new UANamespace({
                addressSpace: this,
                index,
                namespaceUri,
                publicationDate: new Date(),
                version: "undefined"
            })
        );
         return this._namespaceArray[index];
    }

    /***
     * @method getNamespaceArray
     * @return {Namespace[]} the namespace array
     */
    public getNamespaceArray(): NamespacePrivate[] {
        return this._namespaceArray;
    }

    /**
     *
     * @method addAlias
     * @param alias {String} the alias name
     * @param nodeId {NodeId}
     * @internal
     */
    public addAlias(alias: string, nodeId: NodeId): void {
        assert(typeof alias === "string");
        assert(nodeId instanceof NodeId);
        this.getNamespace(nodeId.namespace).addAlias(alias, nodeId);
    }

    /**
     * find an node by node Id
     * @method findNode
     * @param nodeId   a nodeId or a string coerce-able to nodeID, representing the object to find.
     * @return {BaseNode|null}
     */
    public findNode(nodeId: NodeIdLike): BaseNode | null {
        if (!(nodeId instanceof NodeId)) {
            nodeId = this.resolveNodeId(nodeId);
        }
        if (nodeId.namespace < 0 || nodeId.namespace >= this._namespaceArray.length) {
            // namespace index is out of bound
            return null;
        }
        const namespace = this._namespaceArray[nodeId.namespace];
        return namespace.findNode2(nodeId) as BaseNode;
    }

    public findMethod(nodeId: NodeId | string): UAMethod | null {
        const node = this.findNode(nodeId);
        assert(node instanceof UAMethod);
        return node as UAMethod;
    }

    /**
     * resolved a string or a nodeId to a nodeID
     */
    public resolveNodeId(nodeId: NodeIdLike): NodeId {
        if (typeof nodeId === "string") {
            const m = nodeId.match(regexNumberColumnString);
            if (m && m.length === 3) {
                const namespaceIndex = parseInt(m[1], 10);
                const aliasName = m[2];
                const namespace = this.getNamespace(namespaceIndex);
                // check if the string is a known alias
                const aliasNodeId = namespace.resolveAlias(aliasName);
                if (aliasNodeId !== null) {
                    return aliasNodeId;
                }
            }
        }
        return resolveNodeId(nodeId);
    }

    /**
     *
     * @method findObjectType
     * @param objectType  {String|NodeId|QualifiedName}
     * @param [namespaceIndex=0 {Number}] an optional namespace index
     * @return {UAObjectType|null}
     *
     * @example
     *
     *     const objectType = addressSpace.findObjectType("ns=0;i=58");
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType("BaseObjectType");
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType(resolveNodeId("ns=0;i=58"));
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType("CustomObjectType",36);
     *     objectType.nodeId.namespace.should.eql(36);
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     *
     *     const objectType = addressSpace.findObjectType("36:CustomObjectType");
     *     objectType.nodeId.namespace.should.eql(36);
     *     objectType.browseName.toString().should.eql("BaseObjectType");
     */
    public findObjectType(objectType: NodeIdLike, namespaceIndex?: number): UAObjectTypePublic | null {
        if (objectType instanceof NodeId) {
            return _find_by_node_id<UAObjectType>(this, objectType, namespaceIndex);
        }
        const [namespace, browseName] = _extract_namespace_and_browse_name_as_string(this, objectType, namespaceIndex);
        return namespace.findObjectType(browseName);
    }

    /**
     * @method findVariableType
     * @param variableType  {String|NodeId}
     * @param [namespaceIndex=0 {Number}] an optional namespace index
     * @return {UAObjectType|null}
     *
     * @example
     *
     *     const objectType = addressSpace.findVariableType("ns=0;i=62");
     *     objectType.browseName.toString().should.eql("BaseVariableType");
     *
     *     const objectType = addressSpace.findVariableType("BaseVariableType");
     *     objectType.browseName.toString().should.eql("BaseVariableType");
     *
     *     const objectType = addressSpace.findVariableType(resolveNodeId("ns=0;i=62"));
     *     objectType.browseName.toString().should.eql("BaseVariableType");
     */
    public findVariableType(variableType: string | NodeId, namespaceIndex?: number): UAVariableTypePublic | null {
        if (variableType instanceof NodeId) {
            return _find_by_node_id<UAVariableType>(this, variableType, namespaceIndex);
        }
        const [namespace, browseName] = _extract_namespace_and_browse_name_as_string(this, variableType, namespaceIndex);
        return namespace.findVariableType(browseName);
    }

    /**
     * Find the DataType node from a NodeId or a browseName
     * @method findDataType
     * @param dataType {String|NodeId}
     * @param [namespaceIndex=0 {Number}] an optional namespace index
     * @return {DataType|null}
     *
     *
     * @example
     *
     *      const dataDouble = addressSpace.findDataType("Double");
     *
     *      const dataDouble = addressSpace.findDataType(resolveNodeId("ns=0;i=3"));
     */
    public findDataType(dataType: number | string | NodeId | DataType, namespaceIndex?: number): UADataType | null {
        // startingNode i=24  :
        // BaseDataType
        // +-> Boolean (i=1) {BooleanDataType (ns=2:9898)
        // +-> String (i=12)
        //     +->NumericRange
        //     +->Time
        // +-> DateTime
        // +-> Structure
        //       +-> Node
        //            +-> ObjectNode
        if (dataType instanceof NodeId) {
            return _find_by_node_id<UADataType>(this, dataType!, namespaceIndex);
        }
        if (typeof dataType === "number") {
            if (DataType[dataType] !== undefined) {
                dataType = DataType[dataType];
            } else {
                return this.findDataType(resolveNodeId(dataType));
            }
        }
        const res = _extract_namespace_and_browse_name_as_string(this, dataType, namespaceIndex);
        const namespace = res[0];
        const browseName = res[1];
        return namespace.findDataType(browseName) as UADataType;
    }

    /**
     * @method findCorrespondingBasicDataType
     *
     * @example
     *
     *     const dataType = addressSpace.findDataType("ns=0;i=12");
     *     addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);
     *
     *     const dataType = addressSpace.findDataType("ServerStatusDataType"); // ServerStatus
     *     addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
     *
     */
    public findCorrespondingBasicDataType(dataTypeNode: NodeIdLike | UADataType): DataType {
        const _orig_dataTypeNode = dataTypeNode;
        if (typeof dataTypeNode === "string") {
            const resolvedDataType = this.resolveNodeId(dataTypeNode);
            /* istanbul ignore next */
            if (!resolvedDataType) {
                throw new Error("Cannot resolve " + _orig_dataTypeNode.toString());
            }
            dataTypeNode = resolvedDataType;
        }

        if (dataTypeNode instanceof NodeId) {
            dataTypeNode = this.findDataType(dataTypeNode)!;
            /* istanbul ignore next */
            if (!dataTypeNode) {
                throw Error("cannot find dataTypeNode " + _orig_dataTypeNode.toString());
            }
        }
        /* istanbul ignore next */
        if (!(dataTypeNode instanceof UADataType)) {
            throw new Error(
                "we are expecting an UADataType here :  " +
                    _orig_dataTypeNode.toString() +
                    " should not refer to a  " +
                    dataTypeNode.constructor.name
            );
        }
        dataTypeNode = dataTypeNode as UADataType;

        const enumerationType = this.findDataType("Enumeration")!;
        if (sameNodeId(enumerationType.nodeId, dataTypeNode!.nodeId)) {
            return DataType.Int32;
        }

        if (dataTypeNode.nodeId.namespace === 0 && dataTypeNode.nodeId.value === 29) {
            // Number
            return DataType.Null; //which one ?
        }

        if (dataTypeNode.nodeId.namespace === 0 && DataType[dataTypeNode.nodeId.value as number]) {
            return dataTypeNode.nodeId.value as DataType;
        }
        return this.findCorrespondingBasicDataType(dataTypeNode.subtypeOfObj as UADataType);
    }

    /**
     * find a ReferenceType by its inverse name.
     * @method findReferenceTypeFromInverseName
     * @param inverseName  the inverse name of the ReferenceType to find
     * @deprecated
     */
    public findReferenceTypeFromInverseName(inverseName: string): UAReferenceType | null {
        return this.getDefaultNamespace().findReferenceTypeFromInverseName(inverseName) as UAReferenceType;
    }

    /**
     * @method findReferenceType
     * @param refType {String|NodeId}
     * @param [namespaceIndex=0 {Number}] an optional namespace index
     * @return {ReferenceType|null}
     *
     * refType could be
     *    a string representing a nodeid       : e.g.    'i=9004' or ns=1;i=6030
     *    a string representing a browse name  : e.g     'HasTypeDefinition'
     *      in this case it should be in the alias list
     *
     */
    public findReferenceType(refType: NodeIdLike, namespaceIndex?: number): UAReferenceType | null {
        // startingNode ns=0;i=31 : References
        //  References i=31
        //  +->(hasSubtype) NonHierarchicalReferences
        //                  +->(hasSubtype) HasTypeDefinition
        //  +->(hasSubtype) HierarchicalReferences
        //                  +->(hasSubtype) HasChild/ChildOf
        //                                  +->(hasSubtype) Aggregates/AggregatedBy
        //                                                  +-> HasProperty/PropertyOf
        //                                                  +-> HasComponent/ComponentOf
        //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
        //                                 +->(hasSubtype) HasSubtype/HasSupertype
        //                  +->(hasSubtype) Organizes/OrganizedBy
        //                  +->(hasSubtype) HasEventSource/EventSourceOf
        let node: UAReferenceType | null;

        if (isNodeIdString(refType) || typeof refType === "number") {
            refType = resolveNodeId(refType);
        }
        if (refType instanceof NodeId) {
            node = this.findNode(refType) as UAReferenceType;
            /* istanbul ignore next */
            if (!(node && node.nodeClass === NodeClass.ReferenceType)) {
                // throw new Error("cannot resolve referenceId "+ refType.toString());
                return null;
            }
        } else {
            assert(typeof refType === "string");
            node = this._findReferenceType(refType, namespaceIndex) as UAReferenceType;
        }
        return node;
    }

    /**
     * returns the inverse name of the referenceType.
     *
     * @method inverseReferenceType
     * @param referenceType {String} : the reference type name
     * @return {String} the name of the inverse reference type.
     *
     * @example
     *
     *    ```javascript
     *    addressSpace.inverseReferenceType("OrganizedBy").should.eql("Organizes");
     *    addressSpace.inverseReferenceType("Organizes").should.eql("OrganizedBy");
     *    ```
     *
     */
    public inverseReferenceType(referenceType: string): string {
        assert(typeof referenceType === "string");
        const n1 = this.findReferenceType(referenceType);
        const n2 = this.findReferenceTypeFromInverseName(referenceType);
        if (n1) {
            assert(!n2);
            return n1.inverseName!.text as string;
        } else {
            assert(n2);
            return n2!.browseName.toString();
        }
    }

    /**
     * find an EventType node in the address space
     * @method findEventType
     * @param eventTypeId {String|NodeId|UAObjectType} the eventType to find
     * @param namespaceIndex the namespace index of the event to find
     * @return {UAObjectType|null} the EventType found or null.
     *
     * note:
     *    - the method with throw an exception if a node is found
     *      that is not a BaseEventType or a subtype of it.
     *
     * @example
     *
     *     var evtType = addressSpace.findEventType("AuditEventType");
     *
     */
    public findEventType(eventTypeId: NodeIdLike | UAEventType, namespaceIndex?: number): UAEventType | null {
        let eventType: UAEventType;

        if (eventTypeId instanceof BaseNode) {
            eventType = eventTypeId as UAEventType;
        } else {
            eventType = this.findObjectType(eventTypeId as NodeIdLike, namespaceIndex) as UAEventType;
        }
        if (!eventType) {
            return null;
        }

        const baseEventType = this.findObjectType("BaseEventType");

        /* istanbul ignore next */
        if (!baseEventType) {
            throw new Error("expecting BaseEventType - please check you nodeset xml file!");
        }

        if (sameNodeId(eventType.nodeId, baseEventType.nodeId)) {
            return eventType as UAObjectType;
        }
        /* eventTypeNode should be isSupertypeOf("BaseEventType"); */
        /* istanbul ignore next */
        if (!eventType.isSupertypeOf(baseEventType)) {
            throw new Error("findEventType: event found is not subType of BaseEventType");
        }
        return eventType as UAEventType;
    }

    /**
     * EventId is generated by the Server to uniquely identify a particular Event Notification.
     * @method generateEventId
     * @return {Variant}  dataType: "ByteString"
     */
    public generateEventId(): VariantT<Buffer, DataType.ByteString> {
        /*
         * OpcUA 1.02 part 5 : 6.4.2 BaseEventType
         * The Server is responsible to ensure that each Event has its unique EventId.
         * It may do this, for example, by putting GUIDs into the ByteString.
         * Clients can use the EventId to assist in minimizing or eliminating gaps and overlaps that may occur during
         * a redundancy fail-over. The EventId shall always be returned as value and the Server is not allowed to
         * return a StatusCode for the EventId indicating an error.
         *
         */
        const offset = 16;
        const self = this as any;
        if (!self._eventIdCounter) {
            self._eventIdCounter = randomBytes(20);
            self._eventIdCounter.writeInt32BE(0, offset);
        }
        self._eventIdCounter.writeInt32BE(self._eventIdCounter.readInt32BE(offset) + 1, offset);

        return new Variant({
            dataType: DataType.ByteString,
            value: Buffer.from(self._eventIdCounter)
        }) as VariantT<Buffer, DataType.ByteString>;
    }

    /*=
     * construct a simple javascript object with all the default properties of the event
     * @method constructEventData
     *
     * @return result.$eventDataSource {BaseNode} the event type node
     * @return result.eventId {NodeId} the
     * ...
     *
     *
     * eventTypeId can be a UAEventType
     *
     * @private
     */
    public constructEventData(eventTypeId: UAEventTypePublic, data: any): IEventData {
        const addressSpace = this;

        data = data || {};

        // construct the reference dataStructure to store event Data
        let eventTypeNode = eventTypeId;

        // make sure that eventType is really a object that derived from EventType
        if (eventTypeId instanceof UAObjectType) {
            eventTypeNode = addressSpace.findEventType(eventTypeId)!;
        }

        /* istanbul ignore next */
        if (!eventTypeNode) {
            throw new Error(" cannot find EvenType for " + eventTypeId);
        }
        assert(eventTypeNode instanceof UAObjectType, "eventTypeId must represent a UAObjectType");

        // eventId
        assert(!data.hasOwnProperty("eventId"), "eventId constructEventData : options object should not have eventId property");
        data.eventId = data.eventId || addressSpace.generateEventId();

        // eventType
        data.eventType = { dataType: DataType.NodeId, value: eventTypeNode.nodeId };

        // sourceNode
        assert(data.hasOwnProperty("sourceNode"), "expecting a source node to be defined");
        data.sourceNode = new Variant(data.sourceNode);
        assert(data.sourceNode.dataType === DataType.NodeId);

        // sourceName
        const sourceNode = addressSpace.findNode(data.sourceNode.value)!;

        data.sourceName = data.sourceName || {
            dataType: DataType.String,
            value: sourceNode.getDisplayName("en")
        };

        const nowUTC = new Date();

        // time (UtcTime)
        // TODO
        data.time = data.time || { dataType: DataType.DateTime, value: nowUTC };

        // receivedTime  (UtcTime)
        // TODO
        data.receiveTime = data.receiveTime || { dataType: DataType.DateTime, value: nowUTC };

        // localTime  (UtcTime)
        // TODO
        data.localTime = data.localTime || { dataType: DataType.DateTime, value: nowUTC };

        // message  (LocalizedText)
        data.message = data.message || { dataType: DataType.LocalizedText, value: { text: "" } };

        // severity  (UInt16)
        data.severity = data.severity || { dataType: DataType.UInt16, value: 0 };

        // xx // reminder : event type cannot be instantiated directly !
        // xx assert(eventTypeNode.isAbstract);

        const baseObjectType = addressSpace.findObjectType("BaseObjectType"); // i=58
        /* istanbul ignore next */
        if (!baseObjectType) {
            throw new Error("BaseObjectType must be defined in the address space");
        }

        const visitedProperties: { [key: string]: any } = {};

        function _process_var(self: BaseNode, prefix: string, node: BaseNode) {
            const lowerName = prefix + lowerFirstLetter(node.browseName!.name!);
            // istanbul ignore next
            // xx if (doDebug) { debugLog("      " + lowerName.toString()); }

            visitedProperties[lowerName] = node;
            if (data.hasOwnProperty(lowerName)) {
                eventData.setValue(lowerName, node, data[lowerName]);
                // xx eventData[lowerName] = _coerceVariant(data[lowerName]);
            } else {
                // add a property , but with a null variant
                eventData.setValue(lowerName, node, { dataType: DataType.Null });

                if (doDebug) {
                    if (node.modellingRule === "Mandatory") {
                        // tslint:disable:no-console
                        console.log(
                            chalk.red("ERROR : AddressSpace#constructEventData(eventType,options) " + "cannot find property ") +
                                self.browseName.toString() +
                                " => " +
                                chalk.cyan(lowerName)
                        );
                    } else {
                        console.log(
                            chalk.yellow(
                                "Warning : AddressSpace#constructEventData(eventType,options)" + " cannot find property "
                            ) +
                                self.browseName.toString() +
                                " => " +
                                chalk.cyan(lowerName)
                        );
                    }
                }
            }
        }

        // verify that all elements of data are valid
        function verify_data_is_valid(data1: { [key: string]: any }) {
            Object.keys(data1).map((k: string) => {
                if (k === "$eventDataSource") {
                    return;
                }
                /* istanbul ignore next */
                if (!visitedProperties.hasOwnProperty(k)) {
                    throw new Error(
                        " cannot find property '" +
                            k +
                            "' in [ " +
                            Object.keys(visitedProperties).join(", ") +
                            "] when filling " +
                            eventTypeNode.browseName.toString()
                    );
                }
            });
        }

        function populate_data(self: any, eventData1: any) {
            if (sameNodeId(baseObjectType!.nodeId, self.nodeId)) {
                return; // nothing to do
            }

            const baseTypeNodeId = self.subtypeOf;
            /* istanbul ignore next */
            if (!baseTypeNodeId) {
                throw new Error("Object " + self.browseName.toString() + " with nodeId " + self.nodeId + " has no Type");
            }

            const baseType = addressSpace.findNode(baseTypeNodeId);
            /* istanbul ignore next */
            if (!baseType) {
                throw new Error(chalk.red("Cannot find object with nodeId ") + baseTypeNodeId);
            }

            populate_data(baseType, eventData1);

            // get properties and components from base class
            const properties = self.getProperties();
            const components = self.getComponents();
            const children = ([] as BaseNode[]).concat(properties, components);

            // istanbul ignore next
            if (doDebug) {
                console.log(" " + chalk.bgWhite.cyan(self.browseName.toString()));
            }

            for (const node of children) {
                // only keep those that have a "HasModellingRule"
                if (!(node as any).modellingRule) {
                    // xx console.log(" skipping node without modelling rule", node.browseName.toString());
                    continue;
                }
                // ignore also methods
                if (node.nodeClass === NodeClass.Method) {
                    // xx console.log(" skipping method ", node.browseName.toString());
                    continue;
                }

                _process_var(self, "", node);

                // also store value in index
                // xx eventData.__nodes[node.nodeId.toString()] = eventData[lowerName];

                const children2 = node.getAggregates();
                if (children2.length > 0) {
                    const lowerName = lowerFirstLetter(node.browseName.name!);
                    //  console.log(" Children to visit = ",lowerName,
                    //  children.map(function(a){ return a.browseName.toString();}).join(" "));
                    for (const child2 of children2) {
                        _process_var(self, lowerName + ".", child2);
                    }
                }
            }
        }

        const eventData = new EventData(eventTypeNode);

        // verify standard properties...
        populate_data(eventTypeNode, eventData);

        verify_data_is_valid(data);

        return eventData;
    }

    // - Browse --------------------------------------------------------------------------------------------------------
    /**
     * browse some path.
     *
     * @method browsePath
     * @param  {BrowsePath} browsePath
     * @return {BrowsePathResult}
     *
     * This service can be used translates one or more browse paths into NodeIds.
     * A browse path is constructed of a starting Node and a RelativePath. The specified starting Node
     * identifies the Node from which the RelativePath is based. The RelativePath contains a sequence of
     * ReferenceTypes and BrowseNames.
     *
     *   |StatusCode                    |                                                            |
     *   |------------------------------|:-----------------------------------------------------------|
     *   |BadNodeIdUnknown              |                                                            |
     *   |BadNodeIdInvalid              |                                                            |
     *   |BadNothingToDo                | - the relative path contains an empty list )               |
     *   |BadBrowseNameInvalid          | - target name is missing in relative path                  |
     *   |UncertainReferenceOutOfServer | - The path element has targets which are in another server.|
     *   |BadTooManyMatches             |                                                            |
     *   |BadQueryTooComplex            |                                                            |
     *   |BadNoMatch                    |                                                            |
     *
     *
     *
     */
    public browsePath(browsePath: BrowsePath): BrowsePathResult {
        assert(browsePath instanceof BrowsePath);

        const startingNode = this.findNode(browsePath.startingNode);

        if (!startingNode) {
            return new BrowsePathResult({ statusCode: StatusCodes.BadNodeIdUnknown });
        }

        if (!browsePath.relativePath.elements || browsePath.relativePath.elements.length === 0) {
            return new BrowsePathResult({
                statusCode: StatusCodes.BadNothingToDo,
                targets: []
            });
        }

        const elements_length = browsePath.relativePath.elements.length;
        // -------------------------------------------------------------------------------------------------------
        // verify standard RelativePath construction
        //   from OPCUA 1.03 - PArt 3 - 7.6 RelativePath:
        //   TargetName  The BrowseName of the target node.
        //               The final element may have an empty targetName. In this situation all targets of the
        //               references identified by the referenceTypeId are the targets of the RelativePath.
        //               The targetName shall be specified for all other elements.
        //               The current path cannot be followed any further if no targets with the specified
        //               BrowseName exist.
        //   Let's detect null targetName which are not in last position and return BadBrowseNameInvalid if not
        //
        const empty_targetName_not_in_lastPos = browsePath.relativePath.elements.reduce((prev, e, index) => {
            const is_last = index + 1 === elements_length;
            const isBad = !is_last && (!e.targetName || e.targetName.isEmpty());
            return prev + (!is_last && (!e.targetName || e.targetName.isEmpty()) ? 1 : 0);
        }, 0);
        if (empty_targetName_not_in_lastPos) {
            return new BrowsePathResult({ statusCode: StatusCodes.BadBrowseNameInvalid });
        }

        // from OPCUA 1.03 - PArt 3 - 5.8.4 TranslateBrowsePathToNodeIds
        // TranslateBrowsePathToNodeIds further restrict RelativePath targetName rules:
        // The last element in the relativePath shall always have a targetName specified.
        const last_el = browsePath.relativePath.elements[elements_length - 1];
        if (!last_el.targetName || !last_el.targetName.name || last_el.targetName.name.length === 0) {
            return new BrowsePathResult({ statusCode: StatusCodes.BadBrowseNameInvalid });
        }

        const res: BrowsePathTargetOptions[] = [];

        const explore_element = (curNodeObject: BaseNode, elements: RelativePathElement[], index: number) => {
            const element = elements[index];
            assert(element instanceof RelativePathElement);

            const is_last = index + 1 === elements.length;

            const nodeIds = curNodeObject.browseNodeByTargetName(element, is_last);

            const targets = nodeIds.map((nodeId: NodeId) => {
                return {
                    remainingPathIndex: elements.length - index,
                    targetId: nodeId
                };
            });

            if (!is_last) {
                // explorer
                for (const target of targets) {
                    const node = this.findNode(target.targetId);
                    if (!node) {
                        continue;
                    }
                    explore_element(node, elements, index + 1);
                }
            } else {
                for (const target of targets) {
                    res.push({
                        remainingPathIndex: 0xffffffff,
                        targetId: coerceExpandedNodeId(target.targetId)
                    });
                }
            }
        };

        explore_element(startingNode, browsePath.relativePath.elements, 0);

        if (res.length === 0) {
            return new BrowsePathResult({ statusCode: StatusCodes.BadNoMatch });
        }

        return new BrowsePathResult({
            statusCode: StatusCodes.Good,
            targets: res
        });
    }

    // - Extension Object ----------------------------------------------------------------------------------------------
    public getExtensionObjectConstructor(dataType: NodeId | UADataType): ExtensionObjectConstructorFuncWithSchema {
        assert(dataType, "expecting a dataType");

        if (dataType instanceof NodeId) {
            const tmp = this.findNode(dataType);
            /* istanbul ignore next */
            if (!tmp) {
                throw new Error("getExtensionObjectConstructor: cannot resolve dataType " + dataType);
            }
            dataType = tmp as UADataType;
        }
        /* istanbul ignore next */
        if (!(dataType instanceof UADataType)) {
            // may be dataType was the NodeId of the "Binary Encoding" node
            throw new Error("getExtensionObjectConstructor: dataType has unexpected type" + dataType);
        }
        const _dataType = dataType as UADataType;
       
        // to do verify that dataType is of type "Structure"
        /* istanbul ignore next */
        if (!_dataType.isSupertypeOf(this.findDataType("Structure")!)) {
            console.log(_dataType.toString());
        }
        assert(_dataType.isSupertypeOf(this.findDataType("Structure")!));
        if (!_dataType._extensionObjectConstructor) {
            const dataTypeManager = (this as any).$$extraDataTypeManager as ExtraDataTypeManager;
            _dataType._extensionObjectConstructor = dataTypeManager.getExtensionObjectConstructorFromDataType(
                _dataType.nodeId
            ) as ExtensionObjectConstructorFuncWithSchema;
        }
        assert(_dataType._extensionObjectConstructor, "dataType must have a constructor");
        const Constructor = _dataType._extensionObjectConstructor;
        return Constructor;
    }

    /**
     * @param dataType
     * @param [options]
     * @return the constructed extension object
     *
     *
     * @example
     *
     *             // example 1
     *             var extObj = addressSpace.constructExtensionObject("BuildInfo",{ productName: "PRODUCTNAME"});
     *
     *             // example 2
     *             serverStatusDataType.nodeClass.should.eql(NodeClass.DataType);
     *             serverStatusDataType.browseName.toString().should.eql("ServerStatusDataType");
     *             var serverStatus  = addressSpace.constructExtensionObject(serverStatusDataType);
     *             serverStatus.constructor.name.should.eql("ServerStatusDataType");
     */
    public constructExtensionObject(dataType: UADataType | NodeId, options: any): ExtensionObject {
        const Constructor = this.getExtensionObjectConstructor(dataType);
        return new Constructor(options);
    }

    /**
     * cleanup all resources maintained by this addressSpace.
     * @method dispose
     */
    public dispose() {
        this._namespaceArray.map((namespace: NamespacePrivate) => namespace.dispose());
        AddressSpace.registry.unregister(this);
        /* istanbul ignore next */
        if (this._shutdownTask && this._shutdownTask.length > 0) {
            throw new Error("AddressSpace#dispose : shutdown has not been called");
        }
    }

    /**
     * register a function that will be called when the server will perform its shut down.
     * @method registerShutdownTask
     */
    public registerShutdownTask(task: (this: AddressSpace) => void): void {
        this._shutdownTask = this._shutdownTask || [];
        assert(typeof task === "function");
        this._shutdownTask.push(task);
    }

    public shutdown() {
        if (!this._shutdownTask) {
            return;
        }
        // perform registerShutdownTask
        this._shutdownTask.forEach((task: any) => {
            task.call(this);
        });
        this._shutdownTask = [];
    }

    /**
     *
     * @method browseSingleNode
     * @param nodeId {NodeId|String} : the nodeid of the element to browse
     * @param browseDescription
     * @param browseDescription.browseDirection {BrowseDirection} :
     * @param browseDescription.referenceTypeId {String|NodeId}
     * @param [session]
     * @return {BrowseResult}
     */
    public browseSingleNode(nodeId: NodeIdLike, browseDescription: BrowseDescription, context?: SessionContext): BrowseResult {
        const browseResult: BrowseResultOptions = {
            continuationPoint: undefined,
            references: null,
            statusCode: StatusCodes.Good
        };

        if (!browseDescription || browseDescription.browseDirection === BrowseDirection.Invalid) {
            browseResult.statusCode = StatusCodes.BadBrowseDirectionInvalid;
            return new BrowseResult(browseResult);
        }

        browseDescription.browseDirection = adjustBrowseDirection(browseDescription.browseDirection, BrowseDirection.Forward);

        /* istanbul ignore next */
        if (typeof nodeId === "number") {
            throw new Error("Not Implemented");
        }

        if (typeof nodeId === "string") {
            const node = this.findNode(this.resolveNodeId(nodeId));
            if (node) {
                nodeId = node.nodeId;
            }
        }

        // check if referenceTypeId is correct
        if (browseDescription.referenceTypeId instanceof NodeId) {
            if (browseDescription.referenceTypeId.value === 0) {
                (browseDescription as any).referenceTypeId = null;
            } else {
                const rf = this.findNode(browseDescription.referenceTypeId);
                if (!rf || !(rf instanceof UAReferenceType)) {
                    browseResult.statusCode = StatusCodes.BadReferenceTypeIdInvalid;
                    return new BrowseResult(browseResult);
                }
            }
        }

        const obj = this.findNode(nodeId);

        if (!obj) {
            // Object Not Found
            browseResult.statusCode = StatusCodes.BadNodeIdUnknown;
            // xx console.log("xxxxxx browsing ",nodeId.toString() , " not found" );
        } else {
            browseResult.statusCode = StatusCodes.Good;
            browseResult.references = obj.browseNode(browseDescription, context);
        }
        return new BrowseResult(browseResult);
    }

    /**
     * @param folder
     * @private
     */
    public _coerceFolder(folder: UAObject): BaseNode | null {
        folder = this._coerceNode(folder) as UAObject;
        /* istanbul ignore next */
        if (folder && !_isFolder(this, folder)) {
            throw new Error("Parent folder must be of FolderType " + folder.typeDefinition.toString());
        }
        return (folder as any) as BaseNode;
    }

    /**
     *
     * @param view
     * @param modelChange
     * @private
     */
    public _collectModelChange(view: UAView | null, modelChange: any) {
        // xx console.log("in _collectModelChange", modelChange.verb, verbFlags.get(modelChange.verb).toString());
        this._modelChanges.push(modelChange);
    }

    /**
     *
     * walk up the hierarchy of objects until a view is found
     * objects may belong to multiples views.
     * Note: this method doesn't return the main view => Server object.
     * @method extractRootViews
     * @param node {BaseNode}
     * @return {BaseNode[]}
     */
    /**
     *
     * @param node
     * @private
     */
    public extractRootViews(node: UAObject | UAVariable): UAView[] {
        const addressSpace = this;
        assert(node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable);

        const visitedMap: any = {};

        const q = new Dequeue();
        q.push(node);

        const objectsFolder = addressSpace.rootFolder.objects;
        assert(objectsFolder instanceof UAObject);

        const results: UAView[] = [];

        while (q.length) {
            node = q.shift();

            const references = node.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse);

            const parentNodes = references.map((r: UAReference) => Reference.resolveReferenceNode(addressSpace, r) as BaseNode);

            for (const parent of parentNodes) {
                if (sameNodeId(parent.nodeId, objectsFolder.nodeId)) {
                    continue; // nothing to do
                }
                if (parent.nodeClass === NodeClass.View) {
                    results.push(parent as UAView);
                } else {
                    const key = parent.nodeId.toString();
                    if (visitedMap.hasOwnProperty(key)) {
                        continue;
                    }
                    visitedMap[key] = parent;
                    q.push(parent);
                }
            }
        }
        return results;
    }

    /**
     *
     * @param func
     * @private
     */
    public modelChangeTransaction(func: any) {
        const addressSpace = this;

        this._modelChangeTransactionCounter = this._modelChangeTransactionCounter || 0;

        function beginModelChange(this: AddressSpace) {
            /* jshint validthis:true */
            assert(this);
            this._modelChanges = this._modelChanges || [];
            assert(this._modelChangeTransactionCounter >= 0);
            this._modelChangeTransactionCounter += 1;
        }

        function endModelChange(this: AddressSpace) {
            /* jshint validthis:true */
            this._modelChangeTransactionCounter -= 1;

            if (this._modelChangeTransactionCounter === 0) {
                if (this._modelChanges.length === 0) {
                    return; // nothing to do
                }
                // xx console.log( "xx dealing with ",this._modelChanges.length);
                // increase version number of participating nodes

                // https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore
                // const nodeIds = _.uniq(this._modelChanges.map((c: any) => c.affected));
                const nodeIds = [...new Set(this._modelChanges.map((c: any) => c.affected))];

                const nodes = nodeIds.map((nodeId: NodeId) => addressSpace.findNode(nodeId)!);

                nodes.forEach(_increase_version_number);
                // raise events

                if (this.rootFolder.objects.server) {
                    const eventTypeNode = addressSpace.findEventType("GeneralModelChangeEventType");

                    if (eventTypeNode) {
                        // xx console.log("xx raising event on server object");
                        addressSpace.rootFolder.objects.server.raiseEvent(eventTypeNode, {
                            // Part 5 - 6.4.32 GeneralModelChangeEventType
                            changes: { dataType: "ExtensionObject", value: this._modelChanges }
                        });
                    }
                }
                this._modelChanges = [];
                // _notifyModelChange(this);
            }
        }

        beginModelChange.call(this);
        try {
            func();
        } catch (err) {
            throw err;
        } finally {
            endModelChange.call(this);
        }
    }

    /**
     * normalize the ReferenceType field of the Reference Object
     * @param params.referenceType  {String|nodeId}
     * @param params.isForward  {Boolean} default value: true;
     * @return {Object} a new reference object  with the normalized name { referenceType: <value>, isForward: <flag>}
     */
    public normalizeReferenceType(params: AddReferenceOpts | Reference): Reference {
        if (params instanceof Reference) {
            // a reference has already been normalized
            return params;
        }
        // ----------------------------------------------- handle is forward
        assert(params.isForward === undefined || typeof params.isForward === "boolean");
        params.isForward = utils.isNullOrUndefined(params.isForward) ? true : !!params.isForward;

        // referenceType = Organizes   , isForward = true =>   referenceType = Organizes , isForward = true
        // referenceType = Organizes   , isForward = false =>  referenceType = Organizes , isForward = false
        // referenceType = OrganizedBy , isForward = true =>   referenceType = Organizes , isForward = **false**
        // referenceType = OrganizedBy , isForward = false =>  referenceType = Organizes , isForward =  **true**

        // ----------------------------------------------- handle referenceType
        if (params.referenceType instanceof UAReferenceType) {
            params.referenceType = params.referenceType as UAReferenceType;
            params.referenceType = params.referenceType.nodeId;
        } else if (typeof params.referenceType === "string") {
            const inv = this.findReferenceTypeFromInverseName(params.referenceType);
            if (inv) {
                params.referenceType = inv.nodeId;
                params._referenceType = inv;
                params.isForward = !params.isForward;
            } else {
                params.referenceType = resolveNodeId(params.referenceType);
                const refType = this.findReferenceType(params.referenceType);
                if (refType) {
                    params._referenceType = refType;
                }
            }
        }
        assert(params.referenceType instanceof NodeId);

        // ----------- now resolve target NodeId;
        if (params.nodeId instanceof BaseNode) {
            assert(!params.hasOwnProperty("node"));
            params.node = params.nodeId as BaseNode;
            params.nodeId = params.node.nodeId;
        } else {
            let _nodeId = params.nodeId! as NodeId;
            assert(!!_nodeId, "missing 'nodeId' in reference");
            if (_nodeId && (_nodeId as any).nodeId) {
                _nodeId = (_nodeId as any).nodeId as NodeId;
            }
            _nodeId = resolveNodeId(_nodeId);
            /* istanbul ignore next */
            if (!(_nodeId instanceof NodeId) || _nodeId.isEmpty()) {
                // tslint:disable:no-console
                console.log("xx =>", JSON.stringify(params, null, " "));
                throw new Error(" Invalid reference nodeId " + _nodeId.toString());
            }
            params.nodeId = _nodeId;
        }
        return new Reference(params);
    }

    /**
     *
     * @param references
     */
    public normalizeReferenceTypes(references: AddReferenceOpts[] | Reference[] | null): Reference[] {
        if (!references || references.length === 0) {
            return [];
        }
        references = references as Reference[] | AddReferenceOpts[];
        assert(Array.isArray(references));

        return (references as any).map((el: Reference | AddReferenceOpts) => this.normalizeReferenceType(el));
    }

    // -- Historical Node  -----------------------------------------------------------------------------------------
    /**
     *
     * @param node
     * @param options
     */
    public installHistoricalDataNode(node: UAVariable, options?: IHistoricalDataNodeOptions): void {
        AddressSpace_installHistoricalDataNode.call(this, node, options);
    }

    // -- Alarms & Conditions  -----------------------------------------------------------------------------------------
    /**
     *
     */
    public installAlarmsAndConditionsService() {
        UAConditionBase.install_condition_refresh_handle(this);
        UAAcknowledgeableConditionBase.install_method_handle_on_type(this);
    }

    // -- internal stuff -----------------------------------------------------------------------------------------------
    public _coerceNode(node: string | BaseNode | NodeId): BaseNode | null {
        function hasTypeDefinition(node1: BaseNode) {
            return (
                node1.nodeClass === NodeClass.Variable ||
                node1.nodeClass === NodeClass.Object ||
                node1.nodeClass === NodeClass.Method
            );
        }

        // coerce to BaseNode object
        if (node instanceof BaseNode) {
            return node as BaseNode;
        }
        // it's a node id like
        // coerce parent folder to an object
        const returnValue = this.findNode(resolveNodeId(node));
        /*
         if (!hasTypeDefinition(node as BaseNode)) {
             node = this.findNode(node.nodeId) || node;
             if (!node || !hasTypeDefinition(node)) {
                 return null;
             }
         }
         */
        return returnValue;
    }

    public _coerce_DataType(dataType: NodeId | string | BaseNode): NodeId {
        if (dataType instanceof NodeId) {
            // xx assert(self.findDataType(dataType));
            return dataType;
        }
        return this._coerce_Type(dataType, DataTypeIds, "DataTypeIds", AddressSpace.prototype.findDataType);
    }

    public _coerceTypeDefinition(typeDefinition: string | NodeId): NodeId {
        if (typeof typeDefinition === "string") {
            // coerce parent folder to an node
            const typeDefinitionNode = this.findNode(typeDefinition)!;
            typeDefinition = typeDefinitionNode.nodeId;
        }
        // xx console.log("typeDefinition = ",typeDefinition);
        assert(typeDefinition instanceof NodeId);
        return typeDefinition;
    }

    public _coerceType<T extends BaseNode>(baseType: string | NodeId | BaseNode, topMostBaseType: string, nodeClass: NodeClass): T {
        assert(typeof topMostBaseType === "string");
        const topMostBaseTypeNode = this.findNode(topMostBaseType) as T;

        /* istanbul ignore next */
        if (!topMostBaseTypeNode) {
            throw new Error("Cannot find topMostBaseTypeNode " + topMostBaseType.toString());
        }
        assert(topMostBaseTypeNode instanceof BaseNode);
        assert(topMostBaseTypeNode.nodeClass === nodeClass);

        if (!baseType) {
            return topMostBaseTypeNode;
        }

        assert(typeof baseType === "string" || baseType instanceof BaseNode);
        let baseTypeNode: T;
        if (baseType instanceof BaseNode) {
            baseTypeNode = baseType as T;
        } else {
            baseTypeNode = this.findNode(baseType) as T;
        }

        /* istanbul ignore next*/
        if (!baseTypeNode) {
            throw new Error("Cannot find ObjectType or VariableType for " + baseType.toString());
        }
        /* istanbul ignore next */
        if (!(baseTypeNode as any).isSupertypeOf) {
            throw new Error("Cannot find ObjectType or VariableType for " + baseType.toString());
        }
        /* istanbul ignore next */
        if (!(baseTypeNode as any).isSupertypeOf(topMostBaseTypeNode)) {
            throw new Error("wrong type ");
        }
        return baseTypeNode;
    }

    public _coerce_VariableTypeIds(dataType: NodeId | string | BaseNode): NodeId {
        return this._coerce_Type(dataType, VariableTypeIds, "VariableTypeIds", AddressSpace.prototype.findVariableType);
    }

    public _register(node: BaseNode): void {
        assert(node.nodeId instanceof NodeId);
        const namespace = this.getNamespace(node.nodeId.namespace);
        namespace._register(node);
    }

    public deleteNode(nodeOrNodeId: NodeId | BaseNode): void {
        _getNamespace(this, nodeOrNodeId).deleteNode(nodeOrNodeId);
    }

    public isEnumeration(dataType: NodeId): boolean {
        // DataType must be one of Enumeration
        const dataTypeNode = this.findDataType(dataType) as UADataType;
        if (!dataTypeNode) {
            throw new Error(" Cannot find  DataType  " + dataType.toString() + " in standard address Space");
        }

        const enumerationNode = this.findDataType("Enumeration")!;
        if (!enumerationNode) {
            throw new Error(" Cannot find 'Enumeration' DataType in standard address Space");
        }
        return dataTypeNode.isSupertypeOf(enumerationNode);
    }

    private _coerce_Type(dataType: BaseNode | string | NodeId, typeMap: any, typeMapName: string, finderMethod: any): NodeId {
        if (dataType instanceof BaseNode) {
            dataType = dataType.nodeId;
        }
        assert(typeMap !== null && typeof typeMap === "object");
        let nodeId: NodeId | null;
        if (typeof dataType === "string") {
            const namespace0 = this.getDefaultNamespace();
            // resolve dataType
            nodeId = namespace0.resolveAlias(dataType);
            if (!nodeId) {
                // dataType was not found in the aliases database
                if (typeMap[dataType]) {
                    nodeId = makeNodeId(typeMap[dataType], 0);
                    return nodeId;
                } else {
                    nodeId = resolveNodeId(dataType);
                }
            }
        } else if (typeof dataType === "number") {
            nodeId = makeNodeId(dataType, 0);
        } else {
            nodeId = resolveNodeId(dataType);
        }
        /* istanbul ignore next */
        if (nodeId == null || !(nodeId instanceof NodeId)) {
            throw new Error("Expecting valid nodeId ");
        }
        const el = finderMethod.call(this, nodeId);

        if (!el) {
            // verify that node Id exists in standard type map typeMap
            const find = Object.values(typeMap).filter((a) => a === nodeId!.value);
            /* istanbul ignore next */
            if (find.length !== 1) {
                throw new Error(" cannot find " + dataType.toString() + " in typeMap " + typeMapName + " L = " + find.length);
            }
        }
        return nodeId;
    }

    private _constructNamespaceArray() {
        if (this._namespaceArray.length === 0) {
            this.registerNamespace("http://opcfoundation.org/UA/");
        }
    }

    private _findReferenceType(refType: NodeId | string, namespaceIndex?: number): UAReferenceTypePublic | null {
        if (refType instanceof NodeId) {
            return _find_by_node_id<UAReferenceType>(this, refType, namespaceIndex);
        }
        const [namespace, browseName] = _extract_namespace_and_browse_name_as_string(this, refType, namespaceIndex);
        return namespace.findReferenceType(browseName);
    }
}

function _getNamespace(addressSpace: AddressSpace, nodeOrNodId: BaseNode | NodeId): NamespacePrivate {
    const nodeId: NodeId = nodeOrNodId instanceof BaseNode ? nodeOrNodId.nodeId : (nodeOrNodId as NodeId);
    return addressSpace.getNamespace(nodeId.namespace);
}

function _find_by_node_id<T extends BaseNode>(addressSpace: AddressSpace, nodeId: NodeId, namespaceIndex?: number): T {
    const obj = addressSpace.findNode(nodeId);
    return obj as T;
}

/**
 * return true if nodeId is a Folder
 * @method _isFolder
 * @param addressSpace
 * @param folder
 * @return {Boolean}
 * @private
 */
function _isFolder(addressSpace: AddressSpace, folder: UAObject): boolean {
    const folderType = addressSpace.findObjectType("FolderType")!;
    assert(folder instanceof BaseNode);
    assert(folder.typeDefinitionObj);
    return folder.typeDefinitionObj.isSupertypeOf(folderType);
}

function _increase_version_number(node: BaseNode | null) {
    if (node && node.nodeVersion) {
        const previousValue = parseInt(node.nodeVersion.readValue().value.value, 10);
        node.nodeVersion.setValueFromSource({
            dataType: DataType.String,
            value: (previousValue + 1).toString()
        });
        // xx console.log("xxx increasing version number of node ", node.browseName.toString(),previousValue);
    }
}
