import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { AnyConstructorFunc } from "node-opcua-schemas";
import type { StatusCode } from "node-opcua-status-code";
import type { BrowseDescription, BrowsePath, BrowsePathResult, BrowseResult } from "node-opcua-types";
import type { DataType, Variant, VariantByteString } from "node-opcua-variant";
//
import type { AddReferenceOpts, BaseNode } from "./base_node";
import type { IEventData } from "./i_event_data";
import type { INamespace } from "./namespace";
import type { ISessionContext } from "./session_context";
import type { UADataType } from "./ua_data_type";
import type { UAEventType } from "./ua_event_type";
import type { UAMethod } from "./ua_method";
import type { UAObject } from "./ua_object";
import type { UAObjectType } from "./ua_object_type";
import type { UAReference } from "./ua_reference";
import type { UAReferenceType } from "./ua_reference_type";
import type { IHistoricalDataNodeOptions, UAVariable } from "./ua_variable";
import type { UAVariableType } from "./ua_variable_type";
import type { UAView } from "./ua_view";

export type ShutdownTask = ((this: IAddressSpace) => void) | ((this: IAddressSpace) => Promise<void>);

/**
 * A method call interceptor is invoked before every UAMethod.execute() call.
 * Return `StatusCodes.Good` to allow the call, or any other StatusCode to reject it.
 * The interceptor may be synchronous or asynchronous.
 */
export type MethodCallInterceptor = (
    context: ISessionContext,
    object: UAObject | UAObjectType | null,
    method: UAMethod,
    inputArguments: Variant[]
) => StatusCode | Promise<StatusCode>;

interface UARootFolder_Objects extends UAObject {
    server: UAObject;
}
export interface IAddressSpace {
    rootFolder: { objects: UARootFolder_Objects; views: UAObject; types: UAObject };

    historizingNodes?: Set<UAVariable>;

    /**
     * when this flag is set, properties and components are not added as javascript
     * member of the UAObject/UAVariable node
     */
    isFrugal: boolean;

    resolveNodeId(nodeIdLike: NodeIdLike): NodeId;

    findNode(node: NodeIdLike): BaseNode | null;

    /**
     *
     * @example
     *
     * ```javascript
     *     const variableType = addressSpace.findVariableType("ns=0;i=62");
     *     variableType.browseName.toString().should.eql("BaseVariableType");
     *
     *     const variableType = addressSpace.findVariableType("BaseVariableType");
     *     variableType.browseName.toString().should.eql("BaseVariableType");
     *
     *     const variableType = addressSpace.findVariableType(resolveNodeId("ns=0;i=62"));
     *     variableType.browseName.toString().should.eql("BaseVariableType");
     * ```
     */
    findVariableType(variableTypeId: NodeIdLike, namespaceIndex?: number): UAVariableType | null;

    findMethod(nodeId: NodeIdLike): UAMethod | null;

    /**
     * find an EventType node in the address space
     *
     * @param objectTypeId the eventType to find
     * @param namespaceIndex an optional index to restrict the search in a given namespace
     * @return the EventType found or null.
     *
     * notes:
     *
     *    - if objectTypeId is of type NodeId, the namespaceIndex shall not be specified
     * @example
     *
     * ```ts
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
     * ```
     */
    findObjectType(objectTypeId: NodeIdLike, namespaceIndex?: number): UAObjectType | null;

    /**
     * find an EventType node in the address space
     *
     * @param eventTypeId the eventType to find
     * @param namespaceIndex an optional index to restrict the search in a given namespace
     * @return the EventType found or null.
     *
     * note:
     *    - the method with throw an exception if a node is found
     *      that is not a BaseEventType or a subtype of it.
     *    - if eventTypeId is of type NodeId, the namespaceIndex shall not be specified
     *
     * @example
     *
     * ```javascript
     *  const evtType = addressSpace.findEventType("AuditEventType");
     *  ```
     *
     */
    findEventType(eventTypeId: NodeIdLike | UAObjectType, namespaceIndex?: number): UAObjectType | null;

    findReferenceType(referenceTypeId: NodeIdLike | UAReferenceType, namespaceIndex?: number): UAReferenceType | null;

    /**
     * find a ReferenceType by its inverse name.
     * @param inverseName the inverse name of the ReferenceType to find
     */
    findReferenceTypeFromInverseName(inverseName: string): UAReferenceType | null;

    findDataType(dataType: string | NodeId | UADataType | DataType, namespaceIndex?: number): UADataType | null;

    findCorrespondingBasicDataType(dataType: NodeIdLike | UADataType): DataType;

    deleteNode(node: NodeId | BaseNode): void;

    getDefaultNamespace(): INamespace;

    getOwnNamespace(): INamespace;

    getNamespace(indexOrName: number | string): INamespace;

    registerNamespace(namespaceUri: string): INamespace;

    getNamespaceIndex(namespaceUri: string): number;

    getNamespaceUri(namespaceIndex: number): string;

    getNamespaceArray(): INamespace[];

    browseSingleNode(nodeId: NodeIdLike, browseDescription: BrowseDescription, context?: ISessionContext): BrowseResult;

    browsePath(browsePath: BrowsePath): BrowsePathResult;

    inverseReferenceType(referenceType: string): string;

    // -------------- Extension Objects
    /**
     * get the extension object constructor from a DataType nodeID or UADataType object
     */
    getExtensionObjectConstructor(dataType: NodeId | UADataType): AnyConstructorFunc;

    /**
     * construct an extension object constructor from a DataType nodeID or UADataType object
     *
     */
    constructExtensionObject(dataType: UADataType | NodeId, options?: Record<string, unknown>): ExtensionObject;

    // -------------- Event helpers

    /***
     * construct a simple javascript object with all the default properties of the event
     *
     *
     *
     * eventTypeId can be a UAObjectType deriving from EventType
     * or an instance of a ConditionType
     *
     */
    constructEventData(eventTypeId: UAEventType, data: Record<string, unknown>): IEventData;

    /**
     * walk up the hierarchy of objects until a view is found
     * objects may belong to multiples views.
     * Note: this method doesn't return the main view => Server object.
     * @param node
     * @internal
     */
    extractRootViews(node: UAObject | UAVariable): UAView[];

    // -------------- Historizing support
    installHistoricalDataNode(variableNode: UAVariable, options?: IHistoricalDataNodeOptions): void;

    // -------------- Shutdown helpers
    /**
     *  register a task that will be executed just before the address space is disposed.
     */
    registerShutdownTask(task: ShutdownTask): void;

    /**
     * shutdown the address space by executingthe registered shutdown tasks.
     * @see registerShutdownTask, dispose
     */
    shutdown(): Promise<void>;

    dispose(): void;

    installAlarmsAndConditionsService(): void;

    normalizeReferenceType(params: AddReferenceOpts | UAReference): UAReference;

    /**
     * EventId is generated by the Server to uniquely identify a particular Event Notification.
     */
    generateEventId(): VariantByteString;

    // -------------- Method call interceptors
    /**
     * Register a method call interceptor.
     * Interceptors are called sequentially before each UAMethod.execute().
     * If any interceptor returns a non-Good StatusCode, the method call
     * is rejected and subsequent interceptors are skipped.
     */
    addMethodCallInterceptor(interceptor: MethodCallInterceptor): void;

    /**
     * Remove a previously registered method call interceptor.
     */
    removeMethodCallInterceptor(interceptor: MethodCallInterceptor): void;
}
