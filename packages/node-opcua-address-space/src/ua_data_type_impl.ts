/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { NodeClass, QualifiedNameLike } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { ExtensionObject } from "node-opcua-extension-object";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import {
    DataTypeDefinition,
    EnumDefinition,
    EnumFieldOptions,
    StructureDefinition,
    StructureField,
    StructureFieldOptions,
    StructureType
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { UAObject, ISessionContext, UADataType, UAVariable, BaseNode, CreateDataTypeOptions } from "node-opcua-address-space-base";
import { DataTypeIds } from "node-opcua-constants";
import { IStructuredTypeSchema } from "node-opcua-factory";

import { SessionContext } from "../source/session_context";
import { BaseNodeImpl, InternalBaseNodeOptions } from "./base_node_impl";
import { BaseNode_References_toString, BaseNode_toString, ToStringBuilder, ToStringOption } from "./base_node_private";
import * as tools from "./tool_isSupertypeOf";
import { get_subtypeOf } from "./tool_isSupertypeOf";
import { get_subtypeOfObj } from "./tool_isSupertypeOf";
import { BaseNode_getCache } from "./base_node_private";

export type ExtensionObjectConstructor = new (options: any) => ExtensionObject;
export interface ExtensionObjectConstructorFuncWithSchema extends ExtensionObjectConstructor {
    schema: IStructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
}

export interface UADataTypeImpl {
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
export interface UADataTypeOptions extends InternalBaseNodeOptions {
    partialDefinition: StructureFieldOptions[] | EnumFieldOptions[];
    isAbstract?: boolean;
    symbolicName?: string;
}

export class UADataTypeImpl extends BaseNodeImpl implements UADataType {
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

    public get subtypeOfObj(): UADataType | null {
        return get_subtypeOfObj.call(this) as any as UADataType;
    }

    public isSupertypeOf = tools.construct_isSupertypeOf<UADataType>(UADataTypeImpl);

    public readonly isAbstract: boolean;

    private enumStrings?: any;
    private enumValues?: any;
    private $partialDefinition?: StructureFieldOptions[] | EnumFieldOptions[];
    private $fullDefinition?: StructureDefinition | EnumDefinition;

    constructor(options: UADataTypeOptions) {
        super(options);
        if (options.partialDefinition) {
            this.$partialDefinition = options.partialDefinition;
        }
        this.isAbstract = options.isAbstract === undefined || options.isAbstract === null ? false : options.isAbstract;
        this.symbolicName = options.symbolicName || this.browseName.name!;
    }

    public get basicDataType(): DataType {
        return this.getBasicDataType();
    }
    public getBasicDataType(): DataType {
        return this.addressSpace.findCorrespondingBasicDataType(this);
    }

    public readAttribute(
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue {
        assert(!context || context instanceof SessionContext);

        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.IsAbstract:
                options.statusCode = StatusCodes.Good;
                options.value = { dataType: DataType.Boolean, value: !!this.isAbstract };
                break;
            case AttributeIds.DataTypeDefinition:
                {
                    const _definition = this._getDefinition()?.clone();
                    if (_definition !== null) {
                        options.value = { dataType: DataType.ExtensionObject, value: _definition };
                    } else {
                        options.statusCode = StatusCodes.BadAttributeIdInvalid;
                    }
                }
                break;
            default:
                return super.readAttribute(context, attributeId, indexRange, dataEncoding);
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

    isStructure(): boolean {
        const definition = this._getDefinition();
        return !!definition && definition instanceof StructureDefinition;
    }
    getStructureDefinition(): StructureDefinition {
        const definition = this._getDefinition();
        assert(definition instanceof StructureDefinition);
        return definition as StructureDefinition;
    }

    isEnumeration(): boolean {
        const definition = this._getDefinition();
        return !!definition && definition instanceof EnumDefinition;
    }
    getEnumDefinition(): EnumDefinition {
        const definition = this._getDefinition();
        assert(definition instanceof EnumDefinition);
        return definition as EnumDefinition;
    }

    // eslint-disable-next-line complexity
    public _getDefinition(): DataTypeDefinition | null {
        if (this.$fullDefinition !== undefined) {
            return this.$fullDefinition;
        }
        const addressSpace = this.addressSpace;
        const enumeration = addressSpace.findDataType("Enumeration");
        const structure = addressSpace.findDataType("Structure");
        const union = addressSpace.findDataType("Union");

        // we have a data type from a companion specification
        // let's see if this data type need to be registered
        const isEnumeration = enumeration && this.isSupertypeOf(enumeration);
        const isStructure = structure && this.isSupertypeOf(structure);
        const isUnion = !!(structure && union && this.isSupertypeOf(union));

        const isRootDataType = (n: UADataType) => n.nodeId.namespace === 0 && n.nodeId.value === DataTypeIds.BaseDataType;
        // https://reference.opcfoundation.org/v104/Core/docs/Part3/8.49/#Table34
        if (isStructure) {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            let dataTypeNode: UADataTypeImpl | null = this;
            const allPartialDefinitions: StructureFieldOptions[][] = [];
            while (dataTypeNode && !isRootDataType(dataTypeNode)) {
                if (dataTypeNode.$partialDefinition) {
                    allPartialDefinitions.push(dataTypeNode.$partialDefinition as StructureFieldOptions[]);
                }
                dataTypeNode = dataTypeNode.subtypeOfObj as UADataTypeImpl | null;
            }
            // merge them:
            const definitionFields: StructureFieldOptions[] = [];
            for (const dd of allPartialDefinitions.reverse()) {
                definitionFields.push(...dd);
            }
            const basicDataType = this.subtypeOfObj?.nodeId || new NodeId();
            const defaultEncodingId = this.binaryEncodingNodeId || this.xmlEncodingNodeId || new NodeId();
            const definitionName = this.browseName.name!;
            this.$fullDefinition = makeStructureDefinition(
                definitionName,
                basicDataType,
                defaultEncodingId,
                definitionFields,
                isUnion
            );
        } else if (isEnumeration) {
            const allPartialDefinitions: StructureFieldOptions[][] = [];
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            let dataTypeNode: UADataTypeImpl | null = this;
            while (dataTypeNode && !isRootDataType(dataTypeNode)) {
                if (dataTypeNode.$partialDefinition) {
                    allPartialDefinitions.push(dataTypeNode.$partialDefinition as StructureFieldOptions[]);
                }
                dataTypeNode = dataTypeNode.subtypeOfObj as UADataTypeImpl | null;
            }
            // merge them:
            const definitionFields: StructureFieldOptions[] = [];
            for (const dd of allPartialDefinitions.reverse()) {
                definitionFields.push(...dd);
            }
            this.$fullDefinition = makeEnumDefinition(definitionFields);
        }

        return this.$fullDefinition!;
    }

    public getDefinition(): DataTypeDefinition {
        const d = this._getDefinition();
        if (!d) {
            throw new Error("DataType has no definition property");
        }
        return d;
    }

    public install_extra_properties(): void {
        //
    }

    public toString(): string {
        const options = new ToStringBuilder();
        DataType_toString.call(this, options);
        return options.toString();
    }
}

function dataTypeDefinition_toString(this: UADataTypeImpl, options: ToStringOption) {
    const definition = this._getDefinition();
    if (!definition) {
        return;
    }
    const output = definition.toString();
    options.add(options.padding + chalk.yellow(" Definition                   :             "));
    for (const str of output.split("\n")) {
        options.add(options.padding + chalk.yellow("                              :   " + str));
    }
}

export function DataType_toString(this: UADataTypeImpl, options: ToStringOption): void {
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
    options.add(
        options.padding +
            chalk.yellow("          jsonEncodingNodeId  : ") +
            (this.jsonEncodingNodeId ? this.jsonEncodingNodeId.toString() : "<none>")
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

function makeEnumDefinition(definitionFields: EnumFieldOptions[]) {
    return new EnumDefinition({
        fields: definitionFields.map((x) => ({
            description: x.description,
            name: x.name,
            value: x.value
        }))
    });
}
function makeStructureDefinition(
    name: string,
    baseDataType: NodeId,
    defaultEncodingId: NodeId,
    fields: StructureFieldOptions[],
    isUnion: boolean
): StructureDefinition {
    // Structure = 0,
    // StructureWithOptionalFields = 1,
    // Union = 2,
    const hasOptionalFields = fields.filter((field) => field.isOptional).length > 0;

    const structureType = isUnion
        ? StructureType.Union
        : hasOptionalFields
        ? StructureType.StructureWithOptionalFields
        : StructureType.Structure;

    const sd = new StructureDefinition({
        baseDataType,
        defaultEncodingId,
        fields,
        structureType
    });
    return sd;
}

/*
function lockReadOnlyWithWriteDetection<T>(obj: T): T {
    if (obj instanceof Array) {
        return obj.map(lockReadOnlyWithWriteDetection) as unknown as T;
    }
    if (obj instanceof Object) {
        const _org = obj;
        for (const [key, value] of Object.entries(obj)) {
            lockReadOnlyWithWriteDetection(value);
        }
        obj = new Proxy(obj, {
            get: (target: any, prop: string) => {
                return target[prop];
            },
            set: (target: any, prop: string | symbol, value: any, receiver: any) => {
                console.log("QQQQQ Cannot modify stuff ");
                debugger;
                throw new Error("Invalid");
            }
        });
    }
    return obj;
}
*/