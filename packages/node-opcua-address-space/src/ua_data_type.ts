/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { ExtensionObject } from "node-opcua-extension-object";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import {
    DataTypeDefinition,
    EnumDefinition,
    EnumField,
    EnumFieldOptions,
    StructureDefinition,
    StructureField,
    StructureType
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";

import { SessionContext, UADataType as UADataTypePublic, UAVariable } from "../source";
import { BaseNode } from "./base_node";
import { BaseNode_References_toString, BaseNode_toString, ToStringBuilder, ToStringOption } from "./base_node_private";
import * as tools from "./tool_isSupertypeOf";
import { get_subtypeOf } from "./tool_isSupertypeOf";
import { get_subtypeOfObj } from "./tool_isSupertypeOf";
import { UAObject } from "./ua_object";
import { StructuredTypeSchema } from "node-opcua-factory";
import {
    BaseNode_getCache
} from "./base_node_private";
export type ExtensionObjectConstructor = new (options: any) => ExtensionObject;
export interface ExtensionObjectConstructorFuncWithSchema extends ExtensionObjectConstructor {
    schema: StructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
}

export interface UADataType {
    _extensionObjectConstructor: ExtensionObjectConstructorFuncWithSchema;
}

export interface IEnumItem {
    name: string;
    value: number;
}
export interface EnumerationInfo {
    nameIndex: { [id: string]: IEnumItem };
    valueIndex: { [id: number]: IEnumItem };
}

function findBasicDataType(dataType: UADataType): DataType {
    if (dataType.nodeId.namespace === 0 && dataType.nodeId.value <= 25) {
        // we have a well-known DataType
        return dataType.nodeId.value as DataType;
    }
    return findBasicDataType(dataType.subtypeOfObj as UADataType);
}

export class UADataType extends BaseNode implements UADataTypePublic {
    public readonly nodeClass = NodeClass.DataType;
    public readonly definitionName: string = "";
    public readonly symbolicName: string;

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
        return (get_subtypeOfObj.call(this) as any) as UADataTypePublic;
    }

    public isSupertypeOf = tools.construct_isSupertypeOf<UADataTypePublic>(UADataType);

    public readonly isAbstract: boolean;

    private enumStrings?: any;
    private enumValues?: any;
    private $definition?: DataTypeDefinition;
    private $fullDefinition?: DataTypeDefinition;

    constructor(options: any) {
        super(options);
        this.$definition = options.$definition;
        this.isAbstract = options.isAbstract === null ? false : options.isAbstract;
        this.symbolicName = options.symbolicName || this.browseName.name!;
    }

    public get basicDataType(): DataType {
        return findBasicDataType(this);
    }

    public readAttribute(context: SessionContext | null, attributeId: AttributeIds): DataValue {
        assert(!context || context instanceof SessionContext);

        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.IsAbstract:
                options.statusCode = StatusCodes.Good;
                options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
                break;
            case AttributeIds.DataTypeDefinition:
                const _definition = this._getDefinition(true);
                if (_definition !== null) {
                    options.value = { dataType: DataType.ExtensionObject, value: _definition };
                } else {
                    options.statusCode = StatusCodes.BadAttributeIdInvalid;
                }
                break;
            default:
                return super.readAttribute(context, attributeId);
        }
        return new DataValue(options);
    }

    public getEncodingDefinition(encoding_name: string): string | null {
        const encodingNode = this.getEncodingNode(encoding_name);
        if (!encodingNode) {
            throw new Error("Cannot find Encoding for " + encoding_name);
        }
        const indexRange = new NumericRange();
        const descriptionNodeRef = encodingNode.findReferences("HasDescription")[0]!;
        const descriptionNode = this.addressSpace.findNode(descriptionNodeRef.nodeId) as UAVariable;
        if (!descriptionNode) {
            return null;
        }
        const dataValue = descriptionNode.readValue(SessionContext.defaultContext, indexRange);
        return dataValue.value.value.toString() || null;
    }

    public getEncodingNode(encoding_name: string): UAObject | null {
        const _cache = BaseNode_getCache(this);
        const key = encoding_name + "Node";
        if (_cache[key] === undefined) {
            assert(encoding_name === "Default Binary" || encoding_name === "Default XML" || encoding_name === "Default JSON");
            // could be binary or xml
            const refs = this.findReferences("HasEncoding", true);
            const addressSpace = this.addressSpace;
            const encoding = refs
                .map((ref) => addressSpace.findNode(ref.nodeId))
                .filter((obj: any) => obj !== null)
                .filter((obj: any) => obj.browseName.toString() === encoding_name);
            const node = encoding.length === 0 ? null : (encoding[0] as UAObject);
            _cache[key] = node;
        }
        return _cache[key];
    }

    public getEncodingNodeId(encoding_name: string): ExpandedNodeId | null {
        const _cache = BaseNode_getCache(this);
        const key = encoding_name + "NodeId";
        if (_cache[key] === undefined) {
            const encoding = this.getEncodingNode(encoding_name);
            if (encoding) {
                const namespaceUri = this.addressSpace.getNamespaceUri(encoding.nodeId.namespace);
                _cache[key] = ExpandedNodeId.fromNodeId(encoding.nodeId, namespaceUri);
            } else {
                _cache[key] = null;
            }
        }
        return _cache[key];
    }
    /**
     * returns the encoding of this node's
     * TODO objects have 2 encodings : XML and Binaries
     */

    public get binaryEncoding(): BaseNode | null {
        return this.getEncodingNode("Default Binary");
    }
    public get binaryEncodingDefinition(): string | null {
        return this.getEncodingDefinition("Default Binary");
    }
    public get binaryEncodingNodeId(): ExpandedNodeId | null {
        return this.getEncodingNodeId("Default Binary");
    }

    public get xmlEncoding(): BaseNode | null {
        return this.getEncodingNode("Default XML");
    }
    public get xmlEncodingNodeId(): ExpandedNodeId | null {
        return this.getEncodingNodeId("Default XML");
    }
    public get xmlEncodingDefinition(): string | null {
        return this.getEncodingDefinition("Default XML");
    }

    public get jsonEncoding(): BaseNode | null {
        return this.getEncodingNode("Default JSON");
    }

    public get jsonEncodingNodeId(): ExpandedNodeId | null {
        return this.getEncodingNodeId("Default JSON");
    }

    //  public get jsonEncodingDefinition(): string | null {
    //      return this.getEncodingDefinition("Default JSON");
    //  }

    public _getEnumerationInfo(): EnumerationInfo {
        let definition = [];
        if (this.enumStrings) {
            const enumStrings = this.enumStrings.readValue().value.value;
            assert(Array.isArray(enumStrings));
            definition = enumStrings.map((e: any, index: number) => {
                return {
                    name: e.text,
                    value: index
                };
            });
        } else if (this.enumValues) {
            assert(this.enumValues, "must have a enumValues property");
            const enumValues = this.enumValues.readValue().value.value;
            assert(Array.isArray(enumValues));
            definition = enumValues.map((e: any) => {
                return {
                    name: e.displayName.text,
                    value: e.value[1]
                };
            });
        }

        // construct nameIndex and valueIndex
        const indexes: EnumerationInfo = {
            nameIndex: {},
            valueIndex: {}
        };
        for (const e of definition) {
            indexes.nameIndex[e.name] = e;
            indexes.valueIndex[e.value] = e;
        }
        return indexes;
    }

    public _getDefinition(mergeWithBase: boolean): DataTypeDefinition | null {

        if (this.$fullDefinition !== undefined) {
            return mergeWithBase ?this.$fullDefinition:  this.$definition!;
        }
        if (!this.$definition) {
            const structure = this.addressSpace.findDataType("Structure")!;
            if (!structure) {
                return null;
            }
            if (this.isSupertypeOf(structure)) {
                // <Definition> tag was missing in XML file as it was empty
                this.$definition = new StructureDefinition({});
            }
        }

        // https://reference.opcfoundation.org/v104/Core/docs/Part3/8.49/#Table34
        // The list of fields that make up the data type.
        // This definition assumes the structure has a sequential layout.
        // The StructureField DataType is defined in 8.51.
        // For Structures derived from another Structure DataType this list shall begin with the fields
        // of the baseDataType followed by the fields of this StructureDefinition.
 
        // from OPC Unified Architecture, Part 6 86 Release 1.04
        //  A DataTypeDefinition defines an abstract representation of _a UADataType that can be used by
        //  design tools to automatically create serialization code. The fields in the DataTypeDefinition type
        //  are defined in Table F.12.
        const _definition = this.$definition || null;
        if (_definition && _definition instanceof StructureDefinition && this.binaryEncodingNodeId) {
            _definition.defaultEncodingId = this.binaryEncodingNodeId!;
            const subtype = this.subtypeOf;
            if (subtype) {
                _definition.baseDataType = subtype;
            }
        }
        this.$fullDefinition = this.$definition?.clone();
        
        let _baseDefinition: DataTypeDefinition | null = null;
        if (this.subtypeOfObj) {
            _baseDefinition = (this.subtypeOfObj as UADataType)._getDefinition(mergeWithBase);
        }
        if (this.$fullDefinition && this.$definition instanceof StructureDefinition && _baseDefinition) {
            const b = _baseDefinition as StructureDefinition;
            if (b.fields?.length) {
                const f = this.$fullDefinition as StructureDefinition;
                f.fields = (<StructureField[]>[]).concat(b.fields!, f.fields!);    
            }
        }
        return mergeWithBase ? this.$fullDefinition || null : this.$definition || null;
    }
    public getDefinition(): DataTypeDefinition {
        const d = this._getDefinition(true);
        if (!d) {
            throw new Error("DataType has no definition property");
        }
        return d;
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

function dataTypeDefinition_toString(this: UADataType, options: ToStringOption) {
    const definition = this._getDefinition(false);
    if (!definition) {
        return;
    }
    const output = definition.toString();
    options.add(options.padding + chalk.yellow(" Definition                   :             "));
    for (const str of output.split("\n")) {
        options.add(options.padding + chalk.yellow("                              :   " + str));
    }
}

export function DataType_toString(this: UADataType, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    options.add(options.padding + chalk.yellow("          isAbstract          : " + this.isAbstract));
    options.add(options.padding + chalk.yellow("          definitionName      : " + this.definitionName));

    options.add(
        options.padding +
        chalk.yellow("          binaryEncodingNodeId: ") +
        (this.binaryEncodingNodeId ? this.binaryEncodingNodeId.toString() : "<none>")
    );
    options.add(
        options.padding +
        chalk.yellow("          xmlEncodingNodeId   : ") +
        (this.xmlEncodingNodeId ? this.xmlEncodingNodeId.toString() : "<none>")
    );

    if (this.subtypeOfObj) {
        options.add(
            options.padding +
            chalk.yellow("          subtypeOfObj        : ") +
            (this.subtypeOfObj ? this.subtypeOfObj.browseName.toString() : "")
        );
    }
    // references
    BaseNode_References_toString.call(this, options);

    dataTypeDefinition_toString.call(this, options);
}
