/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { ExtensionObject } from "node-opcua-extension-object";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import { isNullOrUndefined } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";

import {
    SessionContext,
    UADataType as UADataTypePublic, UAVariable
} from "../source";
import { BaseNode } from "./base_node";
import { BaseNode_toString, ToStringBuilder, ToStringOption } from "./base_node_private";
import * as  tools from "./tool_isSupertypeOf";
import { get_subtypeOf } from "./tool_isSupertypeOf";
import { get_subtypeOfObj } from "./tool_isSupertypeOf";

type ExtensionObjectConstructor =  new (options: any) => ExtensionObject;

export interface UADataType {
    _extensionObjectConstructor: ExtensionObjectConstructor;
}

export class UADataType extends BaseNode implements UADataTypePublic {

    public readonly nodeClass = NodeClass.DataType;
    public readonly definitionName: string = "";

    /**
     * returns true if this is a super type of baseType
     *
     * @example
     *
     *    var dataTypeDouble = addressSpace.findDataType("Double");
     *    var dataTypeNumber = addressSpace.findDataType("Number");
     *    assert(dataTypeDouble.isSupertypeOf(dataTypeNumber));
     *    assert(!dataTypeNumber.isSupertypeOf(dataTypeDouble));
     *
     */
    public get subtypeOf(): NodeId | null {
        return get_subtypeOf.call(this);
    }

    public get subtypeOfObj(): UADataTypePublic | null {
        return get_subtypeOfObj.call(this) as any as UADataTypePublic;
    }

    public isSupertypeOf = tools.construct_isSupertypeOf<UADataTypePublic>(UADataType);

    public readonly isAbstract: boolean;

    public definition_name: string;
    public definition: any[];

    private enumStrings?: any;
    private enumValues?: any;

    constructor(options: any) {

        super(options);
        this.definition_name = options.definition_name || "<UNKNOWN>";
        this.definition = options.definition || [];
        this.isAbstract = (options.isAbstract === null) ? false : options.isAbstract;
    }

    public readAttribute(context: SessionContext | null, attributeId: AttributeIds): DataValue {

        assert(!context || context instanceof SessionContext);

        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.IsAbstract:
                options.statusCode = StatusCodes.Good;
                options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
                break;
            default:
                return super.readAttribute(context, attributeId);
        }
        return new DataValue(options);
    }

    public getEncodingNode(encoding_name: string): BaseNode | null {

        assert(encoding_name === "Default Binary" || encoding_name === "Default Xml");
        // could be binary or xml
        const refs = this.findReferences("HasEncoding", true);
        const addressSpace = this.addressSpace;
        const encoding = refs
          .map((ref) => addressSpace.findNode(ref.nodeId))
          .filter((obj: any) => obj !== null)
          .filter((obj: any) => obj.browseName.toString() === encoding_name);
        return encoding.length === 0 ? null : encoding[0] as BaseNode;
    }

    /**
     * returns the encoding of this node's
     * TODO objects have 2 encodings : XML and Binaries
     */
    public get binaryEncodingNodeId() {

        const _cache = BaseNode._getCache(this);
        if (!_cache.binaryEncodingNodeId) {
            const encoding = this.getEncodingNode("Default Binary");
            if (encoding) {
                const namespaceUri = this.addressSpace.getNamespaceUri(encoding.nodeId.namespace);
                _cache.binaryEncodingNodeId = ExpandedNodeId.fromNodeId(encoding.nodeId, namespaceUri);
            } else {
                _cache.binaryEncodingNodeId = null;
            }
        }
        return _cache.binaryEncodingNodeId;
    }

    public get binaryEncoding(): BaseNode {
        const _cache = BaseNode._getCache(this);
        if (!_cache.binaryEncodingNode) {
            _cache.binaryEncodingNode = this.__findReferenceWithBrowseName("HasEncoding", "Default Binary");
            // also add namespaceUri
        }
        return _cache.binaryEncodingNode;
    }

    public get binaryEncodingDefinition(): string {
        const indexRange = new NumericRange();
        const descriptionNode = this.binaryEncoding.findReferencesAsObject("HasDescription")[0];
        const structureVar = descriptionNode.findReferencesAsObject(
          "HasComponent", false)[0] as any as UAVariable;
        const dataValue = structureVar.readValue(SessionContext.defaultContext, indexRange);
        // xx if (!dataValue || !dataValue.value || !dataValue.value.value) { return "empty";}
        return dataValue.value.value.toString();
    }

    public get xmlEncoding(): BaseNode {

        const _cache = BaseNode._getCache(this);
        if (!_cache.xmlEncodingNode) {
            _cache.xmlEncodingNode = this.__findReferenceWithBrowseName("HasEncoding", "Default XML");
        }
        return _cache.xmlEncodingNode;
    }

    public get xmlEncodingNodeId(): NodeId {
        const _cache = BaseNode._getCache(this);
        if (!_cache.xmlEncodingNodeId) {
            const encoding = this.getEncodingNode("Default Xml");
            if (encoding) {
                const namespaceUri = this.addressSpace.getNamespaceUri(encoding.nodeId.namespace);
                _cache.xmlEncodingNodeId = ExpandedNodeId.fromNodeId(encoding.nodeId, namespaceUri);
            } else {
                _cache.xmlEncodingNodeId = null;
            }
        }
        return _cache.xmlEncodingNodeId;
    }

    public get xmlEncodingDefinition(): string {
        const indexRange = new NumericRange();
        const descriptionNode = this.xmlEncoding.findReferencesAsObject("HasDescription")[0];
        const structureVar = descriptionNode.findReferencesAsObject(
          "HasComponent", false)[0] as any as UAVariable;
        const dataValue = structureVar.readValue(SessionContext.defaultContext, indexRange);
        if (!dataValue || !dataValue.value || !dataValue.value.value) {
            return "empty";
        }
        return dataValue.value.value.toString();
    }

    public _getDefinition() {

        let definition = [];
        if (this.enumStrings) {
            const enumStrings = this.enumStrings.readValue().value.value;
            assert(_.isArray(enumStrings));
            definition = enumStrings.map((e: any, index: number) => {
                return {
                    name: e.text,
                    value: index
                };
            });
        } else if (this.enumValues) {
            assert(this.enumValues, "must have a enumValues property");
            const enumValues = this.enumValues.readValue().value.value;
            assert(_.isArray(enumValues));
            definition = _.map(enumValues, (e: any) => {
                return {
                    name: e.displayName.text,
                    value: e.value[1]
                };
            });
        }

        // construct nameIndex and valueIndex
        const indexes: any = {
            nameIndex: {},
            valueIndex: {}
        };
        definition.forEach((e: { name: string, value: number }) => {
            indexes.nameIndex[e.name] = e;
            indexes.valueIndex[e.value] = e;
        });
        return indexes;
    }

    public install_extra_properties() {
        //
    }

    public toString(): string {
        const options = new ToStringBuilder();
        DataType_toString.call(this, options);
        return options.toString();
    }
}

function dataTypeDefinition_toString(
  this: UADataType,
  options: ToStringOption
) {
    const indexes = this._getDefinition();

    const output = JSON.stringify(indexes, null, " ");

    options.add(options.padding + chalk.yellow("                              :  definition "));
    for (const str of output.split("\n")) {
        options.add(options.padding + chalk.yellow("                              :   " + str));
    }
}

export function DataType_toString(
  this: UADataType,
  options: ToStringOption
): void {

    BaseNode_toString.call(this, options);
    options.add(options.padding + chalk.yellow("          isAbstract          : " + this.isAbstract));
    options.add(options.padding + chalk.yellow("          definitionName      : " + this.definitionName));

    options.add(options.padding + chalk.yellow("          binaryEncodingNodeId: ") +
      (this.binaryEncodingNodeId ? this.binaryEncodingNodeId.toString() : "<none>"));
    options.add(options.padding + chalk.yellow("          xmlEncodingNodeId   : ") +
      (this.xmlEncodingNodeId ? this.xmlEncodingNodeId.toString() : "<none>"));

    if (this.subtypeOfObj) {
        options.add(options.padding + chalk.yellow("          subtypeOfObj        : ") +
          (this.subtypeOfObj ? this.subtypeOfObj.browseName.toString() : ""));
    }
    dataTypeDefinition_toString.call(this, options);

}
