/**
 * @module node-opcua-client-proxy
 */
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-service-call";
import { WriteValueOptions } from "node-opcua-service-write";
import { DataType, Variant } from "node-opcua-variant";
import { UAProxyManager } from "./proxy_manager";
import { StatusCode } from "node-opcua-status-code";

export interface ArgumentEx extends Argument {
    _basicDataType: DataType;
}
export interface MethodDescription {
    browseName: string;
    executableFlag: boolean;
    func: (input: Record<string, unknown>, callback: (err: Error | null, output?: Record<string, unknown>) => void) => void;
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
    public readonly $components: any[];
    /**
     * the object's properties
     * @property $properties
     * @type {Array<ProxyBaseNode>}
     */
    public $properties: any[];
    /**
     * the object's properties
     * @property $methods
     * @type {Array<ProxyBaseNode>}
     */
    public $methods: MethodDescription[];
    /**
     * the Folder's elements
     * @property $organizes
     * @type {Array<ProxyBaseNode>}
     */
    public $organizes: any[];
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
    public readonly nodeClass: NodeClass;

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
        this.$properties = [];
        this.$methods = [];
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
        const data = dataValue!.value;
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
        str.push("   browseName     : " + this.browseName.toString());
        // str.push("   typeDefinition : " + this.typeDefinition.toString());
        str.push("   $components#   : " + this.$components.length.toString());
        str.push("   $properties#   : " + this.$properties.length.toString());

        return str.join("\n");
    }
}