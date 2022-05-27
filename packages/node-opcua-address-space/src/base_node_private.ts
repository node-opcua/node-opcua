/**
 * @module node-opcua-address-space.Private
 */
// tslint:disable:no-bitwise
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import {
    AccessLevelFlag,
    BrowseDirection,
    coerceLocalizedText,
    coerceQualifiedName,
    LocalizedText,
    NodeClass,
    ResultMask
} from "node-opcua-data-model";
import { checkDebugFlag, make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { ReferenceDescription } from "node-opcua-types";
import {
    IAddressSpace,
    UADataType,
    UAReferenceType,
    ConstructNodeIdOptions,
    CloneExtraInfo,
    CloneFilter,
    BaseNode,
    UAVariable,
    UAMethod,
    UAObject,
    UAObjectType,
    UAVariableType,
    ISessionContext,
    UAReference,
    CloneOptions
} from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";
import { ObjectTypeIds, VariableTypeIds } from "node-opcua-constants";

import { UANamespace_process_modelling_rule } from "./namespace_private";
import { ReferenceImpl } from "./reference_impl";
import { BaseNodeImpl, getReferenceType } from "./base_node_impl";
import { AddressSpacePrivate } from "./address_space_private";

// eslint-disable-next-line prefer-const
let doTrace = checkDebugFlag("INSTANTIATE");
const traceLog = console.log.bind(console);

const g_weakMap = new WeakMap();

const warningLog = make_warningLog(__filename);

interface BaseNodeCache {
    __address_space: IAddressSpace | null;
    _browseFilter?: (this: BaseNode, context?: ISessionContext) => boolean;
    _cache: any;
    _description?: LocalizedText;
    _displayName: LocalizedText[];
    _parent?: BaseNode | null;

    _back_referenceIdx: { [key: string]: UAReference };
    _referenceIdx: { [key: string]: UAReference };

    _subtype_idxVersion: number;
    _subtype_idx: any;
}

export function BaseNode_initPrivate(self: BaseNode): BaseNodeCache {
    const _private: BaseNodeCache = {
        __address_space: null,

        _referenceIdx: {},
        _back_referenceIdx: {},

        _browseFilter: undefined,
        _cache: {},
        _description: undefined,
        _displayName: [],
        _parent: undefined,
        _subtype_idx: {},
        _subtype_idxVersion: 0
    };
    g_weakMap.set(self, _private);
    return _private;
}

export function BaseNode_removePrivate(self: BaseNode): void {
    // there is no need to delete object from weak map
    // the GC will take care of this in due course
    // g_weakMap.delete(self);
    const _private = BaseNode_getPrivate(self);
    _private._cache = {};
    _private.__address_space = null;
    _private._back_referenceIdx = {};
    _private._referenceIdx = {};
    _private._description = undefined;
    _private._displayName = [];
}

export function BaseNode_getPrivate(self: BaseNode): BaseNodeCache {
    return g_weakMap.get(self);
}

export function BaseNode_getCache(node: BaseNode): any {
    return BaseNode_getPrivate(node)._cache;
}
export function BaseNode_clearCache(node: BaseNode): void {
    const _private = BaseNode_getPrivate(node);
    if (_private && _private._cache) {
        _private._cache = {};
    }
}
const hasTypeDefinition_ReferenceTypeNodeId = resolveNodeId("HasTypeDefinition");

export interface ToStringOption {
    level: number;
    cycleDetector: any;
    padding: string;

    add(someLine: string): void;
    indent(a: string, b: string | null): void;
}

export class ToStringBuilder implements ToStringOption {
    public level = 0;
    public cycleDetector: any = {};
    public padding = "";

    private str: string[] = [];

    constructor() {
        //
        this.str = [];
    }
    public add(line: string): void {
        this.str.push(line);
    }
    public toString(): string {
        return this.str.join("\n");
    }

    public indent(str: string, padding: string | null): string {
        padding = padding || "          ";
        return str
            .split("\n")
            .map((r) => {
                return padding + r;
            })
            .join("\n");
    }
}

function set_as_processed(options: ToStringOption, nodeId: NodeId) {
    options.cycleDetector[nodeId.toString()] = nodeId;
}
function is_already_processed(options: ToStringOption, nodeId: NodeId): boolean {
    return !!options.cycleDetector[nodeId.toString()];
}

export function BaseNode_toString(this: BaseNode, options: ToStringOption): void {
    options.level = options.level || 1;

    set_as_processed(options, this.nodeId);

    options.add("");
    options.add(options.padding + chalk.yellow("          nodeId              : ") + this.nodeId.toString());
    options.add(
        options.padding + chalk.yellow("          nodeClass           : ") + NodeClass[this.nodeClass] + " (" + this.nodeClass + ")"
    );
    options.add(options.padding + chalk.yellow("          browseName          : ") + this.browseName.toString());
    options.add(
        options.padding +
            chalk.yellow("          displayName         : ") +
            this.displayName.map((f) => f.locale + " " + f.text).join(" | ")
    );

    options.add(
        options.padding + chalk.yellow("          description         : ") + (this.description ? this.description.toString() : "")
    );
}

export function BaseNode_References_toString(this: BaseNode, options: ToStringOption): void {
    const _private = BaseNode_getPrivate(this);

    const displayOptions = {
        addressSpace: this.addressSpace
    };

    const addressSpace = this.addressSpace;

    options.add(
        options.padding +
            chalk.yellow("    references                : ") +
            "  length =" +
            Object.keys(_private._referenceIdx).length
    );

    function dump_reference(follow: boolean, reference: UAReference | null) {
        if (!reference) {
            return;
        }
        const o = ReferenceImpl.resolveReferenceNode(addressSpace, reference);
        if (!o) {
            warningLog("cannot find referece", reference.toString());
            return;
        }
        const name = o.browseName.toString();
        const modellingRule = o.modellingRule || " ";
        const extra =
            modellingRule[0] +
            (() => {
                switch (o.nodeClass) {
                    case NodeClass.Object:
                        return "[O] ";
                    case NodeClass.Variable:
                        return "[V] " + (o as UAVariable).dataType.toString(displayOptions).padEnd(10);
                    case NodeClass.Method:
                        return "[M] ";
                    case NodeClass.DataType:
                        return "[DT]";
                    case NodeClass.ReferenceType:
                        return "[RT]";
                    case NodeClass.ObjectType:
                        return "[OT]";
                    case NodeClass.VariableType:
                        return "[VT]";
                    case NodeClass.View:
                        return "[V] ";
                }
                return "";
            })();
        options.add(
            options.padding +
                chalk.yellow("      +-> ") +
                reference.toString(displayOptions) +
                " " +
                chalk.cyan(name.padEnd(25, " ")) +
                " " +
                chalk.magentaBright(extra)
        );

        // ignore HasTypeDefinition as it has been already handled
        if (sameNodeId(reference.referenceType, hasTypeDefinition_ReferenceTypeNodeId) && reference.nodeId.namespace === 0) {
            return;
        }
        if (o) {
            if (!is_already_processed(options, o.nodeId)) {
                set_as_processed(options, o.nodeId);
                if (options.level > 1 && follow) {
                    const rr = (o as any).toString({
                        cycleDetector: options.cycleDetector,
                        level: options.level - 1,
                        padding: options.padding + "         "
                    });
                    options.add(rr);
                }
            }
        }
    }

    // direct reference
    (Object.values(_private._referenceIdx) as UAReference[]).forEach(dump_reference.bind(null, true));

    const br = Object.values(_private._back_referenceIdx).map((x) => x);

    options.add(
        options.padding +
            chalk.yellow("    back_references                 : ") +
            chalk.cyan("  length =") +
            br.length +
            chalk.grey(" ( references held by other nodes involving this node)")
    );
    // backward reference
    br.forEach(dump_reference.bind(null, false));
}

function _UAType_toString(this: UAReferenceType | UADataType | UAObjectType | UAVariableType, options: ToStringOption): void {
    if (this.subtypeOfObj) {
        options.add(
            options.padding +
                chalk.yellow("          subtypeOf           : ") +
                this.subtypeOfObj.browseName.toString() +
                " (" +
                this.subtypeOfObj.nodeId.toString() +
                ")"
        );
    }
}

function _UAInstance_toString(this: UAVariable | UAMethod | UAObject, options: ToStringOption): void {
    if (this.typeDefinitionObj) {
        options.add(
            options.padding +
                chalk.yellow("          typeDefinition      : ") +
                this.typeDefinitionObj.browseName.toString() +
                " (" +
                this.typeDefinitionObj.nodeId.toString() +
                ")"
        );
    }
}

export function UAVariableType_toString(this: UAVariableType, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAType_toString.call(this, options);
    VariableOrVariableType_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function UAVariable_toString(this: UAVariable, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAInstance_toString.call(this, options);
    VariableOrVariableType_toString.call(this, options);
    AccessLevelFlags_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function UAObject_toString(this: UAObject, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAInstance_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function UAObjectType_toString(this: UAObjectType, options: ToStringOption): void {
    BaseNode_toString.call(this, options);
    _UAType_toString.call(this, options);
    BaseNode_References_toString.call(this, options);
}

export function valueRankToString(valueRank: number): string {
    switch (valueRank) {
        case 1:
            return "OneDimension (1)";
        case 0:
            return "OneOrMoreDimensions (0)"; // The value is an array with one or more dimensions
        case -1:
            return "Scalar (-1)";
        case -2:
            return "Any (-2)"; // The value can be a scalar or an array with any number of dimensions
        case -3:
            return "ScalarOrOneDimension (2)"; // The value can be a scalar or a one dimensional array.
        default:
            if (valueRank > 0) {
                return "" + valueRank + "-Dimensions";
            } else {
                return "Invalid (" + valueRank + ")";
            }
    }
}

function accessLevelFlagToString(flag: AccessLevelFlag): string {
    const str: string[] = [];
    if (flag & AccessLevelFlag.CurrentRead) {
        str.push("CurrentRead");
    }
    if (flag & AccessLevelFlag.CurrentWrite) {
        str.push("CurrentWrite");
    }
    if (flag & AccessLevelFlag.HistoryRead) {
        str.push("HistoryRead");
    }
    if (flag & AccessLevelFlag.HistoryWrite) {
        str.push("HistoryWrite");
    }
    if (flag & AccessLevelFlag.SemanticChange) {
        str.push("SemanticChange");
    }
    if (flag & AccessLevelFlag.StatusWrite) {
        str.push("StatusWrite");
    }
    if (flag & AccessLevelFlag.TimestampWrite) {
        str.push("TimestampWrite");
    }
    return str.join(" | ");
}

function AccessLevelFlags_toString(this: UAVariable, options: ToStringOption) {
    assert(options);
    options.add(
        options.padding + chalk.yellow("          accessLevel         : ") + " " + accessLevelFlagToString(this.accessLevel)
    );
    if (this.userAccessLevel !== undefined) {
        options.add(
            options.padding + chalk.yellow("          userAccessLevel     : ") + " " + accessLevelFlagToString(this.userAccessLevel)
        );
    }
}

interface WithDataValue {
    $dataValue?: DataValue;
}
export function VariableOrVariableType_toString(this: UAVariableType | UAVariable, options: ToStringOption): void {
    assert(options);
    if (this.dataType) {
        const addressSpace = this.addressSpace;
        const d = addressSpace.findNode(this.dataType);
        const n = d ? "(" + d.browseName.toString() + ")" : " (???)";
        options.add(options.padding + chalk.yellow("          dataType            : ") + this.dataType + "  " + n);
    }
    if (this.nodeClass === NodeClass.Variable) {
        const _dataValue = (<WithDataValue>this).$dataValue as DataValue | undefined;
        if (_dataValue) {
            options.add(
                options.padding +
                    chalk.yellow("          value               : ") +
                    "\n" +
                    options.indent(_dataValue.toString(), options.padding + "                        | ")
            );
        }
    }

    if (Object.prototype.hasOwnProperty.call(this, "valueRank")) {
        if (this.valueRank !== undefined) {
            options.add(
                options.padding + chalk.yellow("          valueRank           : ") + " " + valueRankToString(this.valueRank)
            );
        } else {
            options.add(options.padding + chalk.yellow("          valueRank           : ") + " undefined");
        }
    }
    if (this.minimumSamplingInterval !== undefined) {
        options.add(
            options.padding +
                chalk.yellow(" minimumSamplingInterval      : ") +
                " " +
                this.minimumSamplingInterval.toString() +
                " ms"
        );
    }
    if (this.arrayDimensions) {
        options.add(
            options.padding +
                chalk.yellow(" arrayDimension               : ") +
                " [" +
                this.arrayDimensions.join(",").toString() +
                " ]"
        );
    }
}

const defaultExtraInfo = {
    level: 0,
    pad(): string {
        return "";
    },
    registerClonedObject(node: BaseNode, node1: BaseNode): void {
        /** */
    }
};

/**
 * clone properties and methods
 * @private
 */
function _clone_collection_new(
    newParent: BaseNode,
    collectionRef: UAReference[],
    copyAlsoModellingRules: boolean,
    optionalFilter: CloneFilter,
    extraInfo: CloneExtraInfo,
    browseNameMap: Set<string>
): void {
    const namespace = newParent.namespace;
    extraInfo = extraInfo || defaultExtraInfo;
    const addressSpace = newParent.addressSpace;
    assert(!optionalFilter || (typeof optionalFilter.shouldKeep === "function" && typeof optionalFilter.filterFor === "function"));

    for (const reference of collectionRef) {
        const node = ReferenceImpl.resolveReferenceNode(addressSpace, reference) as UAVariable | UAObject | UAMethod;
        // ensure node is of the correct type,
        // it may happen that the xml nodeset2 file was malformed

        // istanbul ignore next
        if (typeof (node as any).clone !== "function") {
            // tslint:disable-next-line:no-console
            warningLog(
                chalk.red("Warning : cannot clone node ") +
                    node.browseName.toString() +
                    " of class " +
                    NodeClass[node.nodeClass].toString() +
                    " while cloning " +
                    newParent.browseName.toString()
            );
            continue;
        }

        if (optionalFilter && node && !optionalFilter.shouldKeep(node)) {
            doTrace && traceLog(extraInfo.pad(), "skipping optional ", node.browseName.toString(), "that doesn't appear in the filter");
            continue; // skip this node
        }
        const key = node.browseName.toString();
        if (browseNameMap?.has(key)) {
            continue; // skipping node with same browseName
        }
        browseNameMap?.add(key);

        // assert(reference.isForward);
        // assert(reference.referenceType instanceof NodeId, "" + reference.referenceType.toString());
        const options = {
            namespace,
            references: [new ReferenceImpl({ referenceType: reference.referenceType, isForward: false, nodeId: newParent.nodeId })],
            copyAlsoModellingRules
        };

        doTrace &&
            traceLog(
                extraInfo.pad(),
                "cloning => ",
                reference.referenceType.toString({ addressSpace }),
                "=>",
                node.browseName.toString(),
                chalk.magentaBright(node.typeDefinitionObj?.browseName.toString())
            );

        extraInfo.level += 4;
        const clone = (node as UAVariable | UAMethod | UAObject).clone(options, optionalFilter, extraInfo);
        extraInfo.level -= 4;

        // also clone or instantiate interface members that may be required in the optionals
        extraInfo.level++;
        _cloneInterface(newParent, node, optionalFilter, extraInfo, browseNameMap);
        extraInfo.level--;

        if (extraInfo) {
            extraInfo.registerClonedObject(node, clone);
        }
    }
}

type UAInterface = UAObjectType;
function _extractInterfaces2(typeDefinitionNode: UAObjectType | UAVariableType, extraInfo: CloneExtraInfo): UAInterface[] {
    if (
        !typeDefinitionNode ||
        (typeDefinitionNode.nodeId.namespace === 0 &&
            (typeDefinitionNode.nodeId.value === ObjectTypeIds.BaseObjectType ||
                typeDefinitionNode.nodeId.value === VariableTypeIds.BaseVariableType))
    ) {
        return [];
    }

    const addressSpace = typeDefinitionNode.addressSpace;
    // example:
    // FolderType
    //   FunctionalGroupType
    //     MachineryItemIdentificationType     : IMachineryItemVendorNameplateType
    //       MachineIdentificationType         : IMachineTagNameplateType, IMachineVendorNamePlateType
    //         MachineToolIdentificationType
    //
    //
    // IMachineTagNameplateType            -subTypeOf-> ITagNameplateType
    // IMachineVendorNamePlateType         -subTypeOf-> IMachineryItemVendorNamePlateType
    // IMachineryItemVendorNamePlateType   -subTypeOf-> IVendorNameplateType
    const interfacesRef = typeDefinitionNode.findReferencesEx("HasInterface", BrowseDirection.Forward);
    const interfaces = interfacesRef.map((r) => addressSpace.findNode(r.nodeId) as UAInterface);

    const baseInterfaces: UAInterface[] = [];
    for (const iface of interfaces) {
        doTrace &&
            traceLog(
                extraInfo.pad(),
                typeDefinitionNode.browseName.toString(),
                " - has interface -> ",
                iface.browseName.toString()
            );
        baseInterfaces.push(iface);
        if (iface.subtypeOfObj) {
            extraInfo.level++;
            baseInterfaces.push(..._extractInterfaces2(iface.subtypeOfObj, extraInfo));
            extraInfo.level--;
        }
    }
    interfaces.push(...baseInterfaces);
    if (typeDefinitionNode.subtypeOfObj) {
        doTrace &&
            traceLog(
                extraInfo.pad(),
                typeDefinitionNode.browseName.toString(),
                " - subtypef  -> ",
                typeDefinitionNode.subtypeOfObj.browseName.toString()
            );
        extraInfo.level++;
        interfaces.push(..._extractInterfaces2(typeDefinitionNode.subtypeOfObj, extraInfo));
        extraInfo.level--;
    }
    const dedupedInterfaces = [...new Set(interfaces)];

    doTrace &&
        traceLog(
            extraInfo.pad(),
            chalk.yellow("Interface for ", typeDefinitionNode.browseName.toString()),
            "=",
            dedupedInterfaces.map((x) => x.browseName.toString()).join(" ")
        );
    return dedupedInterfaces;
}

/*

    // also find all related interfaces
    if (false && typeDefinitionNode) {
        dotrace && tracelog("typeDefinitionNode = ", typeDefinitionNode.browseName.toString());
        const interfaces = _extractInterfaces(typeDefinitionNode);
        for (const interfaceNode of interfaces) {
            dotrace && tracelog("   adding member of interface ", interfaceNode.browseName.toString());
            const fromInterface = interfaceNode.findReferencesEx("Aggregates", BrowseDirection.Forward);
            dotrace && tracelog(
                "             B   ",
                fromInterface.map((r) => r.toString({ addressSpace }) + " " + r.node!.browseName.toString()).join("\n")
            );
            add(fromInterface);
        }
    }
    */

function _crap_extractInterfaces(typeDefinitionNode: UAObjectType | UAVariableType, extraInfo: CloneExtraInfo): UAInterface[] {
    if (
        typeDefinitionNode.nodeId.namespace === 0 &&
        (typeDefinitionNode.nodeId.value === ObjectTypeIds.BaseObjectType ||
            typeDefinitionNode.nodeId.value === VariableTypeIds.BaseVariableType)
    ) {
        return [];
    }

    const addressSpace = typeDefinitionNode.addressSpace;
    // example:
    // FolderType
    //   FunctionalGroupType
    //     MachineryItemIdentificationType     : IMachineryItemVendorNameplateType
    //       MachineIdentificationType         : IMachineTagNameplateType, IMachineVendorNamePlateType
    //         MachineToolIdentificationType
    //
    //
    // IMachineTagNameplateType            -subTypeOf-> ITagNameplateType
    // IMachineVendorNamePlateType         -subTypeOf-> IMachineryItemVendorNamePlateType
    // IMachineryItemVendorNamePlateType   -subTypeOf-> IVendorNameplateType
    const interfacesRef = typeDefinitionNode.findReferencesEx("HasInterface", BrowseDirection.Forward);
    const interfaces = interfacesRef.map((r) => r.node! as UAInterface);
    for (const iface of interfaces) {
        doTrace && traceLog(extraInfo.pad(), "   interface ", iface.browseName.toString());
    }

    return interfaces;
}

function _cloneInterface(
    newParent: BaseNode,
    node: UAObject | UAVariable | UAMethod,
    optionalFilter: CloneFilter,
    extraInfo: CloneExtraInfo,
    browseNameMap: Set<string>
): void {
    doTrace &&
        traceLog(
            extraInfo?.pad(),
            chalk.green("-------------------- now cloning interfaces of ", node.browseName.toString(), node.nodeId.toString())
        );

    extraInfo = extraInfo || defaultExtraInfo;
    const addressSpace = node.addressSpace;
    const typeDefinitionNode = node.typeDefinitionObj;
    if (!typeDefinitionNode) {
        return;
    }
    const interfaces = _extractInterfaces2(typeDefinitionNode, extraInfo);
    if (interfaces.length === 0) {
        if (doTrace) {
            traceLog(
                extraInfo.pad(),
                chalk.yellow("No interface for ", node.browseName.toString(), node.nodeId.toString())
            );
        }
        return;
    }
    doTrace && traceLog(extraInfo?.pad(), chalk.green("-------------------- interfaces are  ", interfaces.length));

    const localFilter = optionalFilter.filterFor(node);

    for (const iface of interfaces) {
        const aggregates = iface.findReferencesEx("Aggregates", BrowseDirection.Forward);
        doTrace &&
            traceLog(
                extraInfo.pad(),
                chalk.magentaBright("   interface ", iface.browseName.toString()),
                "\n" + extraInfo?.pad(),
                aggregates.map((r) => r.toString({ addressSpace })).join("\n" + extraInfo?.pad())
            );
        _clone_collection_new(node, aggregates, false, localFilter, extraInfo, browseNameMap);
    }
}
export function _clone_children_references(
    node: UAObject | UAVariable | UAMethod | UAObjectType | UAVariableType,
    newParent: UAObject | UAVariable | UAMethod,
    copyAlsoModellingRules: boolean,
    optionalFilter: CloneFilter,
    extraInfo: CloneExtraInfo,
    browseNameMap: Set<string>
): void {
    // find all reference that derives from the Aggregates
    const aggregatesRef = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
    _clone_collection_new(newParent, aggregatesRef, copyAlsoModellingRules, optionalFilter, extraInfo, browseNameMap);
}

export function _clone_non_hierarchical_references(
    node: BaseNode,
    newParent: BaseNode,
    copyAlsoModellingRules: boolean,
    optionalFilter: CloneFilter,
    extraInfo: CloneExtraInfo,
    browseNameMap: Set<string>
): void {
    // clone only some non hierarchical_references that we do want to clone
    // such as:
    //   HasSubStateMachine
    //   (may be other as well later ... to do )
    assert(newParent instanceof BaseNodeImpl);
    // find all reference that derives from the HasSubStateMachine
    const references = node.findReferencesEx("HasSubStateMachine", BrowseDirection.Forward);
    _clone_collection_new(newParent, references, copyAlsoModellingRules, optionalFilter, extraInfo, browseNameMap);
}

/**
 * @method _clone
 * @private
 */
export function _clone<T extends UAObject | UAVariable | UAMethod>(
    this: T,
    Constructor: new (options: any) => T,
    options: CloneOptions,
    optionalFilter: CloneFilter,
    extraInfo: CloneExtraInfo
): T {
    assert(typeof Constructor === "function");
    assert(options !== null && typeof options === "object");
    assert(
        !extraInfo || (extraInfo !== null && typeof extraInfo === "object" && typeof extraInfo.registerClonedObject === "function")
    );
    assert(!(this as any).subtypeOf, "We do not do cloning of Type yet");

    const namespace = options.namespace;
    const constructorOptions: any = {
        ...options,
        addressSpace: namespace.addressSpace,
        browseName: this.browseName,
        description: this.description,
        displayName: this.displayName,
        nodeClass: this.nodeClass
    };
    constructorOptions.references = options.references || [];

    if (this.nodeClass === NodeClass.Variable || this.nodeClass === NodeClass.Object) {
        const voThis = this as UAObject | UAVariable;
        if (voThis.typeDefinition) {
            constructorOptions.references.push(
                new ReferenceImpl({
                    isForward: true,
                    nodeId: voThis.typeDefinition,
                    referenceType: resolveNodeId("HasTypeDefinition")
                })
            );
        }
    }

    if (!constructorOptions.modellingRule) {
        if (this.modellingRule && options.copyAlsoModellingRules) {
            const modellingRuleNode = this.findReferencesAsObject("HasModellingRule", true)[0];
            assert(modellingRuleNode);
            constructorOptions.references.push(
                new ReferenceImpl({
                    isForward: true,
                    nodeId: modellingRuleNode.nodeId,
                    referenceType: resolveNodeId("HasModellingRule")
                })
            );
        }
    } else {
        UANamespace_process_modelling_rule(constructorOptions.references, constructorOptions.modellingRule);
    }

    constructorOptions.nodeId = namespace.constructNodeId(constructorOptions as ConstructNodeIdOptions);

    assert(constructorOptions.nodeId instanceof NodeId);

    const cloneObj = new Constructor(constructorOptions);
    (this.addressSpace as AddressSpacePrivate)._register(cloneObj);

    if (!options.ignoreChildren) {
        // clone children and the rest ....
        options.copyAlsoModellingRules = options.copyAlsoModellingRules || false;

        const newFilter = optionalFilter.filterFor(cloneObj);

        const browseNameMap = new Set<string>();
        _clone_children_references(this, cloneObj, options.copyAlsoModellingRules, newFilter!, extraInfo, browseNameMap);

        //
        let typeDefinitionNode: UAVariableType | UAObjectType | null = this.typeDefinitionObj;
        while (typeDefinitionNode) {
            doTrace &&
                traceLog(
                    extraInfo?.pad(),
                    chalk.blueBright("---------------------- Exploring ", typeDefinitionNode.browseName.toString())
                );
            _clone_children_references(
                typeDefinitionNode,
                cloneObj,
                options.copyAlsoModellingRules,
                newFilter,
                extraInfo,
                browseNameMap
            );
            typeDefinitionNode = typeDefinitionNode.subtypeOfObj;
        }

        _clone_non_hierarchical_references(this, cloneObj, options.copyAlsoModellingRules, newFilter, extraInfo, browseNameMap);
    }
    cloneObj.propagate_back_references();
    cloneObj.install_extra_properties();

    return cloneObj;
}

export function _handle_HierarchicalReference(node: BaseNode, reference: UAReference): void {
    const _cache = BaseNode_getCache(node);
    if (!reference.isForward) return;
    if (_cache._childByNameMap) {
        const addressSpace = node.addressSpace;
        const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);

        if (referenceType) {
            const HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");
            if (referenceType.isSupertypeOf(HierarchicalReferencesType!)) {
                assert(reference.isForward);
                const targetNode = ReferenceImpl.resolveReferenceNode(addressSpace, reference);
                _cache._childByNameMap[targetNode.browseName!.name!.toString()] = targetNode;
            }
        }
    }
}

function _remove_HierarchicalReference(node: BaseNode, reference: UAReference) {
    const _cache = BaseNode_getCache(node);
    if (_cache._childByNameMap) {
        const addressSpace = node.addressSpace;
        const referenceType = ReferenceImpl.resolveReferenceType(addressSpace, reference);

        if (referenceType) {
            const HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");
            if (referenceType.isSupertypeOf(HierarchicalReferencesType!)) {
                assert(reference.isForward);
                const targetNode = ReferenceImpl.resolveReferenceNode(addressSpace, reference);
                // Xx dotrace && tracelog(" adding object to map");
                delete _cache._childByNameMap[targetNode.browseName!.name!.toString()];
            }
        }
    }
}

function _makeReferenceDescription(addressSpace: IAddressSpace, reference: UAReference, resultMask: number): ReferenceDescription {
    const isForward = reference.isForward;

    const referenceTypeId = ReferenceImpl.resolveReferenceType(addressSpace, reference).nodeId;
    assert(referenceTypeId instanceof NodeId);

    const obj = ReferenceImpl.resolveReferenceNode(addressSpace, reference) as any;

    let data: any = {};

    if (!obj) {
        // cannot find reference node
        data = {
            isForward,
            nodeId: reference.nodeId,
            referenceTypeId: resultMask & ResultMask.ReferenceType ? referenceTypeId : null,
            typeDefinition: null
        };
    } else {
        assert(reference.nodeId, " obj.nodeId");
        data = {
            browseName: resultMask & ResultMask.BrowseName ? coerceQualifiedName(obj.browseName) : null,
            displayName: resultMask & ResultMask.DisplayName ? coerceLocalizedText(obj.displayName[0]) : null,
            isForward: resultMask & ResultMask.IsForward ? isForward : false,
            nodeClass: resultMask & ResultMask.NodeClass ? obj.nodeClass : NodeClass.Unspecified,
            nodeId: obj.nodeId,
            referenceTypeId: resultMask & ResultMask.ReferenceType ? referenceTypeId : null,
            typeDefinition: resultMask & ResultMask.TypeDefinition ? obj.typeDefinition : null
        };
    }
    if (data.typeDefinition === null) {
        data.typeDefinition = new NodeId();
    }
    const referenceDescription = new ReferenceDescription(data);
    return referenceDescription;
}

export function _constructReferenceDescription(
    addressSpace: IAddressSpace,
    references: UAReference[],
    resultMask: number
): ReferenceDescription[] {
    assert(Array.isArray(references));
    return references.map((reference: UAReference) => _makeReferenceDescription(addressSpace, reference, resultMask));
}

export function BaseNode_remove_backward_reference(this: BaseNode, reference: UAReference): void {
    const _private = BaseNode_getPrivate(this);
    _remove_HierarchicalReference(this, reference);
    const h = (<ReferenceImpl>reference).hash;
    if (_private._back_referenceIdx && _private._back_referenceIdx[h]) {
        // note : h may not exist in _back_referenceIdx since we are not indexing
        //        _back_referenceIdx to UAObjectType and UAVariableType for performance reasons
        (<ReferenceImpl>_private._back_referenceIdx[h]).dispose();
        delete _private._back_referenceIdx[h];
    }
    (<ReferenceImpl>reference).dispose();
}

export function BaseNode_add_backward_reference(this: BaseNode, reference: UAReference): void {
    const _private = BaseNode_getPrivate(this);

    const h = (<ReferenceImpl>reference).hash;
    assert(typeof h === "string");
    // istanbul ignore next
    if (_private._referenceIdx[h]) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <UAReference>
        //  in this case there is nothing to do
        return;
    }
    // istanbul ignore next
    if (_private._back_referenceIdx[h]) {
        const opts = { addressSpace: this.addressSpace };
        warningLog(" Warning !", this.browseName.toString());
        warningLog("    ", reference.toString(opts));
        warningLog(" already found in ===>");
        warningLog(
            (Object.values(_private._back_referenceIdx) as UAReference[]).map((c: UAReference) => c.toString(opts)).join("\n")
        );
        // tslint:disable-next-line:no-console
        warningLog("===>");
        throw new Error("reference exists already in _back_references");
    }

    if (!getReferenceType(reference)) {
        const stop_here = 1;
    }
    //  assert(reference._referenceType instanceof ReferenceType);
    _private._back_referenceIdx[h] = reference;
    _handle_HierarchicalReference(this, reference);
    (this as any)._clear_caches();
}
