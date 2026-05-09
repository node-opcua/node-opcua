/**
 * @module node-opcua-address-space
 */
import chalk from "chalk";
import type { BaseNode, ISessionContext, UADataType, UAObject, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { coerceInt64, coerceInt64toInt32, type Int64 } from "node-opcua-basic-types";
import { DataTypeIds } from "node-opcua-constants";
import { AttributeIds, type LocalizedText, NodeClass, type QualifiedNameLike } from "node-opcua-data-model";
import { DataValue, type DataValueLike } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExpandedNodeId, NodeId, resolveNodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import {
    type DataTypeDefinition,
    EnumDefinition,
    type EnumFieldOptions,
    type EnumValueType,
    StructureDefinition,
    type StructureFieldOptions,
    StructureType
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import type { ExtensionObjectConstructorFuncWithSchema } from "../source/interfaces/extension_object_constructor";
import { SessionContext } from "../source/session_context";
import { BaseNodeImpl, type InternalBaseNodeOptions } from "./base_node_impl";
import {
    BaseNode_getCache,
    BaseNode_References_toString,
    BaseNode_toString,
    ToStringBuilder,
    type ToStringOption
} from "./base_node_private";
import { construct_isSubtypeOf, get_subtypeOf, get_subtypeOfObj } from "./tool_isSubtypeOf";

const debugLog = make_debugLog("DATA_TYPE");
const doDebug = checkDebugFlag("DATA_TYPE");

export interface StructureFieldOptionsEx extends StructureFieldOptions {
    allowSubTypes: boolean;
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
    isUnion?: boolean;
    isAbstract?: boolean;
    symbolicName?: string;
}

export class UADataTypeImpl extends BaseNodeImpl implements UADataType {
    public _extensionObjectConstructor!: ExtensionObjectConstructorFuncWithSchema;
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
     *    assert(dataTypeDouble.isSubtypeOf(dataTypeNumber));
     *    assert(!dataTypeNumber.isSubtypeOf(dataTypeDouble));
     *
     */
    public get subtypeOf(): NodeId | null {
        return get_subtypeOf.call(this);
    }

    public get subtypeOfObj(): UADataType | null {
        return get_subtypeOfObj.call(this) as unknown as UADataType;
    }

    /** @deprecated */
    public isSupertypeOf = construct_isSubtypeOf<UADataType>(UADataTypeImpl);
    public isSubtypeOf = construct_isSubtypeOf<UADataType>(UADataTypeImpl);

    public readonly isAbstract: boolean;
    private enumStrings?: UAVariable;
    private enumValues?: UAVariable;
    private $partialDefinition?: StructureFieldOptionsEx[] | EnumFieldOptions[];
    private $fullDefinition?: StructureDefinition | EnumDefinition;

    constructor(options: UADataTypeOptions) {
        super(options);
        if (options.partialDefinition) {
            this.$partialDefinition = options.partialDefinition;
        }
        this.isAbstract = options.isAbstract === undefined || options.isAbstract === null ? false : options.isAbstract;
        this.symbolicName = options.symbolicName || this.browseName.name || "";
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
                    if (_definition) {
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
            throw new Error(`Cannot find Encoding for ${encoding_name}`);
        }
        const indexRange = new NumericRange();
        const descriptionNodeRef = encodingNode.findReferences("HasDescription")[0];
        const descriptionNode = this.addressSpace.findNode(descriptionNodeRef.nodeId) as UAVariable;
        if (!descriptionNode) {
            return null;
        }
        const dataValue = descriptionNode.readValue(SessionContext.defaultContext, indexRange);
        return dataValue.value.value.toString() || null;
    }

    public getEncodingNode(encoding_name: string): UAObject | null {
        const _cache = BaseNode_getCache(this);
        _cache._encoding = _cache._encoding || new Map();
        const key = `${encoding_name}Node`;
        if (!_cache._encoding.has(key)) {
            assert(encoding_name === "Default Binary" || encoding_name === "Default XML" || encoding_name === "Default JSON");
            // could be binary or xml
            const refs = this.findReferences("HasEncoding", true);
            const addressSpace = this.addressSpace;
            const encoding = refs
                .map((ref) => addressSpace.findNode(ref.nodeId))
                .filter((obj): obj is BaseNode => obj !== null)
                .filter((obj) => obj.browseName.toString() === encoding_name);
            const node = encoding.length === 0 ? null : (encoding[0] as UAObject);
            _cache._encoding.set(key, node);
            return node;
        }
        return _cache._encoding.get(key) || null;
    }

    public getEncodingNodeId(encoding_name: string): ExpandedNodeId | null {
        const encoding = this.getEncodingNode(encoding_name);
        if (!encoding) {
            return null;
        }
        const namespaceUri = this.addressSpace.getNamespaceUri(encoding.nodeId.namespace);
        return ExpandedNodeId.fromNodeId(encoding.nodeId, namespaceUri);
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
            definition = enumStrings.map((e: LocalizedText, index: number) => {
                return {
                    name: e.text,
                    value: index
                };
            });
        } else if (this.enumValues) {
            assert(this.enumValues, "must have a enumValues property");
            const enumValues = this.enumValues.readValue().value.value;
            assert(Array.isArray(enumValues));
            definition = enumValues.map((e: EnumValueType) => {
                return {
                    name: e.displayName.text,
                    value: coerceInt64toInt32(e.value)
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
        const isEnumeration = enumeration && this.isSubtypeOf(enumeration);
        const isStructure = structure && this.isSubtypeOf(structure);
        const isUnion = !!(structure && union && this.isSubtypeOf(union));

        const isRootDataType = (n: UADataType) => n.nodeId.namespace === 0 && n.nodeId.value === DataTypeIds.BaseDataType;

        // https://reference.opcfoundation.org/v105/Core/docs/Part3/8.49/#Table34
        if (isStructure) {
            let dataTypeNode: UADataTypeImpl | null = this;
            const allPartialDefinitions: StructureFieldOptionsEx[][] = [];
            while (dataTypeNode && !isRootDataType(dataTypeNode)) {
                if (dataTypeNode.$partialDefinition) {
                    allPartialDefinitions.push(dataTypeNode.$partialDefinition as StructureFieldOptionsEx[]);
                }
                dataTypeNode = dataTypeNode.subtypeOfObj as UADataTypeImpl | null;
            }

            // merge them:
            const definitionFields: StructureFieldOptionsEx[] = [];
            for (const dd of allPartialDefinitions.reverse()) {
                definitionFields.push(...dd);
            }

            const basicDataType = this.subtypeOfObj?.nodeId || new NodeId();

            const defaultEncodingId = this.binaryEncodingNodeId || this.xmlEncodingNodeId || new NodeId();

            this.$fullDefinition = makeStructureDefinition(basicDataType, defaultEncodingId, definitionFields, isUnion);
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

        return this.$fullDefinition as DataTypeDefinition;
    }

    public getDefinition(): DataTypeDefinition {
        const d = this._getDefinition();
        /* c8 ignore start */
        if (!d) {
            throw new Error("DataType has no definition property");
        }
        /* c8 ignore stop */
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
        options.add(options.padding + chalk.yellow(`                              :   ${str}`));
    }
}

export function DataType_toString(this: UADataTypeImpl, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    options.add(options.padding + chalk.yellow(`          isAbstract          : ${this.isAbstract}`));
    options.add(options.padding + chalk.yellow(`          definitionName      : ${this.definitionName}`));

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

const defaultEnumValue: Int64 = coerceInt64(-1);

function makeEnumDefinition(definitionFields: EnumFieldOptions[]) {
    return new EnumDefinition({
        fields: definitionFields.map((x) => ({
            description: x.description,
            name: x.name,
            value: x.value === undefined ? defaultEnumValue : coerceInt64(x.value)
        }))
    });
}

function makeStructureDefinition(
    baseDataType: NodeId,
    defaultEncodingId: NodeId,
    fields: StructureFieldOptionsEx[],
    isUnion: boolean
): StructureDefinition {
    const hasSubtypedFields = fields.filter((field) => field.allowSubTypes).length > 0;

    if (hasSubtypedFields && doDebug) {
        debugLog("Fields with subtypes:");
        for (const field of fields) {
            if (field.allowSubTypes) {
                debugLog("  ", field.name, field.dataType?.toString());
            }
        }
    }
    const hasOptionalFields = fields.filter((field) => field.isOptional).length > 0;

    const structureType = isUnion
        ? hasSubtypedFields
            ? StructureType.UnionWithSubtypedValues
            : StructureType.Union
        : hasOptionalFields
          ? StructureType.StructureWithOptionalFields
          : hasSubtypedFields
            ? StructureType.StructureWithSubtypedValues
            : StructureType.Structure;

    // note:  https://reference.opcfoundation.org/Core/Part3/v105/docs/8.51
    // field.isOptional has a special behavior depending on the structure type
    //
    // If the structureType is StructureWithOptionalFields this field indicates if a data type field
    // Structure is optional. In this case a value of FALSE means the StructureField is always present in all
    // occurrences of the Structure DataType and a value of TRUE means the StructureField may be present in an
    // occurrence of the Structure DataType.
    //
    // If the structureType is Structure or Union this field shall be FALSE and shall be ignored
    //
    // If the structureType is StructureWithSubtypedValues, or UnionWithSubtypedValues this field is used to
    // indicate if the data type field allows subtyping.Subtyping is allowed when set to TRUE.

    const isUnionOrStructureWithSubtypedValues =
        structureType === StructureType.UnionWithSubtypedValues || structureType === StructureType.StructureWithSubtypedValues;

    if (isUnionOrStructureWithSubtypedValues) {
        for (const field of fields) {
            if (field.allowSubTypes) {
                // this is a special use of the isOtional flag to indicate that subtyping is allowed for this field
                // see https://reference.opcfoundation.org/Core/Part3/v105/docs/8.51
                field.isOptional = field.allowSubTypes;
            }
        }
    }

    // Normalize: default missing field dataType to BaseDataType (i=24)
    // per OPC UA spec, a missing DataType should reference BaseDataType,
    // not Null NodeId (i=0)
    const baseDataTypeNodeId = resolveNodeId(DataTypeIds.BaseDataType);

    const sd = new StructureDefinition({
        baseDataType,
        defaultEncodingId,
        fields: fields.map((f) => ({
            ...f,
            dataType: f.dataType ?? baseDataTypeNodeId
        })),
        structureType
    });
    return sd;
}
