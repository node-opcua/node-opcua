/**
 * @module node-opcua-client-proxy
 */
import { EventEmitter } from "node:events";
import { assert } from "node-opcua-assert";
import { AttributeIds, type NodeClass } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { Argument } from "node-opcua-service-call";
import type { WriteValueOptions } from "node-opcua-service-write";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType, Variant } from "node-opcua-variant";
import type { UAProxyManager } from "./proxy_manager";
import type { ProxyNode } from "./proxy_transition";
import type { ProxyVariable } from "./proxy_variable";

export interface ArgumentEx extends Argument {
    _basicDataType: DataType;
}
export interface MethodDescription {
    browseName: string;
    executableFlag: boolean;
    func: (input: Record<string, unknown>) => Promise<{ statusCode: StatusCode; output?: Record<string, unknown> }>;
    nodeId: NodeId; // the method NodeId
    inputArguments: ArgumentEx[];
    outputArguments: ArgumentEx[];
}

export class ProxyBaseNode extends EventEmitter {
    /**
     * the object nodeId
     * @property nodeId
     * @type {NodeId}
     */
    public readonly nodeId: NodeId;
    /**
     * the object's components
     * @property $components
     * @type {Array<ProxyBaseNode>}
     */
    public readonly $components: ProxyNode[];
    /**
     * the object's properties
     * @property $properties
     * @type {Array<ProxyBaseNode>}
     */
    public $properties: Record<string, ProxyVariable>;
    /**
     * the object's properties
     * @property $methods
     * @type {Array<ProxyBaseNode>}
     */
    public $methods: Record<string, MethodDescription>;
    /**
     * the Folder's elements
     * @property $organizes
     * @type {Array<ProxyBaseNode>}
     */
    public $organizes: ProxyNode[];
    /**
     * the object's description
     * @property description
     * @type {String}
     */
    public description: string;
    /**
     * the object's browseName
     * @property browseName
     * @type {String}
     */
    public browseName: string;
    /**
     * the object's NodeClass
     * @property nodeClass
     * @type {NodeClass}
     */
    public nodeClass: NodeClass;

    private readonly proxyManager: UAProxyManager;

    constructor(proxyManager: UAProxyManager, nodeId: NodeId, nodeClass: NodeClass) {
        super();

        this.nodeId = nodeId;

        this.proxyManager = proxyManager;
        assert(this.proxyManager.session, "expecting valid session");
        Object.defineProperty(this, "proxyManager", {
            enumerable: false,
            writable: true
        });
        this.$components = [];
        this.$properties = {};
        this.$methods = {};
        this.$organizes = [];

        this.description = "";
        this.browseName = "";
        this.nodeClass = nodeClass;
    }

    /**
     * get a updated Value of the Variable , by using a ReadRequest
     */
    public async readValue(): Promise<Variant> {
        assert(this.proxyManager);

        const session = this.proxyManager.session;
        assert(session);

        const nodeToRead = {
            attributeId: AttributeIds.Value,
            nodeId: this.nodeId
        };
        const dataValue = await this.proxyManager.session.read(nodeToRead);
        const data = dataValue?.value;
        return data;
    }

    /**
     * set the Value of the Variable, by using a WriteRequest
     */
    public async writeValue(dataValue: DataValue): Promise<StatusCode> {
        assert(this.proxyManager);

        const session = this.proxyManager.session;
        assert(session);

        const nodeToWrite: WriteValueOptions = {
            attributeId: AttributeIds.Value,
            nodeId: this.nodeId,
            value: dataValue
        };
        const statusCode = await this.proxyManager.session.write(nodeToWrite);

        return statusCode;
    }

    public toString(): string {
        const str = [];
        str.push(" ProxyObject ");
        str.push(`   browseName     : ${this.browseName.toString()}`);
        // str.push("   typeDefinition : " + this.typeDefinition.toString());
        str.push(`   $components#   : ${this.$components.length.toString()}`);
        str.push(`   $properties#   : ${Object.keys(this.$properties).length.toString()}`);

        return str.join("\n");
    }
}
