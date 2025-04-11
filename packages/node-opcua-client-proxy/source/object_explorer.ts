/**
 * @module node-opcua-client-proxy
 */

import { assert } from "node-opcua-assert";
import { AttributeIds, BrowseDirection, makeNodeClassMask, makeResultMask } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import {
    IBasicSessionReadAsyncSimple,
    IBasicSessionBrowseAsyncSimple
} from "node-opcua-pseudo-session";
import { ReferenceDescription } from "node-opcua-service-browse";
import { CallMethodRequest, Argument } from "node-opcua-service-call";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { make_errorLog, make_debugLog } from "node-opcua-debug";
import { DataTypeIds } from "node-opcua-constants";

import { makeRefId } from "./proxy";
import { UAProxyManager } from "./proxy_manager";
import { ProxyVariable } from "./proxy_variable";
import { MethodDescription, ArgumentEx } from "./proxy_base_node";

const doDebug = false;
const debugLog = make_debugLog("Proxy");

export interface ObjectExplorerOptions {
    proxyManager: UAProxyManager;
    name: string;
    nodeId: NodeId;
    parent: any;
}

const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");

/**

 *
 * @param session
 * @param dataTypeId
 * @param callback
 * @param callback.err
 * @param callback.dataType
 *
 *  @example
 *
 *      const dataTypeId  ="ns=0;i=11"; // Double
 *      convertNodeIdToDataTypeAsync(session,dataTypeId,function(err,dataType) {
 *          assert(!err && dataType === DataType.Double);
 *      });
 *
 *      const dataTypeId  ="ns=0;i=290"; // Duration => SubTypeOf Double
 *      convertNodeIdToDataTypeAsync(session,dataTypeId,function(err,dataType) {
 *          assert(!err && dataType === DataType.Double);
 *      });
 *
 * see also AddressSpace#findCorrespondingBasicDataType
 *
 * for an enumeration dataType will be DataType.Int32
 */
async function convertNodeIdToDataTypeAsync(
    session: IBasicSessionReadAsyncSimple & IBasicSessionBrowseAsyncSimple,
    dataTypeId: NodeId
): Promise<DataType> {
    const nodeToRead = {
        attributeId: AttributeIds.BrowseName,
        nodeId: dataTypeId
    };
    const dataValue = await session.read(nodeToRead);
    let dataType: DataType;
    // istanbul ignore next
    if (dataValue.statusCode.isNotGood()) {
        dataType = DataType.Null;
        return dataType;
    }

    const dataTypeName = dataValue.value.value;

    if (dataTypeId.namespace === 0 && dataTypeId.value === DataTypeIds.Enumeration) {
        dataType = DataType.Int32;
        return dataType;
    }

    if (dataTypeId.namespace === 0 && DataType[dataTypeId.value as number]) {
        dataType = (DataType as any)[dataTypeId.value as number] as DataType;
        return dataType;
    }

    /// example => Duration (i=290) => Double (i=11)
    // read subTypeOf
    const nodeToBrowse = {
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: false,
        nodeId: dataTypeId,
        // BrowseDescription
        referenceTypeId: makeRefId("HasSubtype"),
        // xx nodeClassMask: makeNodeClassMask("ObjectType"),
        resultMask
    };
    // tslint:disable:no-shadowed-variable
    const browseResult = await session.browse(nodeToBrowse);

    const references = browseResult!.references;

    if (!references || references.length !== 1) {
        throw new Error("cannot find SuperType of " + dataTypeName.toString());
    }
    const nodeId = references[0].nodeId;
    return convertNodeIdToDataTypeAsync(session, nodeId);
}

function convertToVariant(value: unknown, arg: ArgumentEx, propName: string): Variant {
    const dataType = arg._basicDataType || DataType.Null;
    const arrayType =
        arg.valueRank === 1 ? VariantArrayType.Array : arg.valueRank === -1 ? VariantArrayType.Scalar : VariantArrayType.Matrix;

    if (value === undefined) {
        throw new Error("expecting input argument ");
    }
    if (arrayType === VariantArrayType.Array) {
        if (!Array.isArray(value)) {
            throw new Error("expecting value to be an Array or a TypedArray");
        }
    }
    return new Variant({ arrayType, dataType, value });
}

function convertToVariantArray(inputArgsDef: ArgumentEx[], inputArgs: Record<string, unknown>): Variant[] {
    const inputArguments: Variant[] = inputArgsDef.map((arg: ArgumentEx) => {
        const propName = lowerFirstLetter(arg.name || "");
        const value = inputArgs[propName];
        return convertToVariant(value, arg, propName);
    });
    return inputArguments;
}

import { ProxyNode } from "./proxy_transition";
import { StatusCode } from "node-opcua-status-code";

function makeFunction(obj: any, methodName: string) {
    return async function functionCaller(this: any, inputArgs: Record<string, unknown>): Promise<{ statusCode: StatusCode, output?: Record<string, unknown> }> {
        const session = this.proxyManager.session;

        const methodDef = this.$methods[methodName];
        // convert input arguments into Variants
        const inputArgsDef = methodDef.inputArguments || [];

        const inputArguments: Variant[] = convertToVariantArray(inputArgsDef, inputArgs);

        const methodToCall = new CallMethodRequest({
            inputArguments,
            methodId: methodDef.nodeId,
            objectId: obj.nodeId
        });

        const callResult = await session.call(methodToCall);

        if (callResult.statusCode.isNotGood()) {
            return { statusCode: callResult.statusCode };
        }

        callResult.outputArguments = callResult.outputArguments || [];

        if (callResult.outputArguments.length !== methodDef.outputArguments.length) {
            throw new Error(
                "Internal error callResult.outputArguments.length " +
                    callResult.outputArguments.length +
                    " " +
                    obj[methodName].outputArguments.length
            );
        }
        const output: Record<string, unknown> = {};
        methodDef.outputArguments.map((arg: Argument, index: number) => {
            const variant = callResult!.outputArguments![index];
            const propName = lowerFirstLetter(arg.name!);
            output[propName] = variant.value;
        });

        return { statusCode: callResult.statusCode, output };
    };
}

async function extractDataType(
    session: IBasicSessionReadAsyncSimple & IBasicSessionBrowseAsyncSimple,
    arg: ArgumentEx
): Promise<void> {
    if (arg.dataType && arg._basicDataType) {
        return;
    }
    const dataType = await convertNodeIdToDataTypeAsync(session, arg.dataType);
    arg._basicDataType = dataType!;
}
/**
 
 * @private
 */
async function add_method(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription): Promise<void> {
    const session = proxyManager.session;

    const methodName = lowerFirstLetter(reference.browseName.name!);

    let inputArguments: ArgumentEx[] = [];
    let outputArguments: ArgumentEx[] = [];

    // tslint:disable:no-shadowed-variable
    const argumentDefinition = await session.getArgumentDefinition(reference.nodeId);
    inputArguments = (argumentDefinition.inputArguments as ArgumentEx[]) || [];
    outputArguments = (argumentDefinition.outputArguments as ArgumentEx[]) || [];

    const promises: Promise<void>[] = [];
    for (const arg of inputArguments || []) {
        promises.push(extractDataType(session, arg));
    }
    for (const arg of outputArguments || []) {
        promises.push(extractDataType(session, arg));
    }
    await Promise.all(promises);

    const methodObj: MethodDescription = {
        browseName: methodName,
        executableFlag: false,
        func: makeFunction(obj, methodName) as any,
        nodeId: reference.nodeId,
        inputArguments,
        outputArguments
    };
    obj.$methods[methodName] = methodObj;
    obj[methodName] = methodObj.func;

    obj[methodName].inputArguments = inputArguments;
    obj[methodName].outputArguments = outputArguments;

    doDebug && debugLog("installing method name", methodName);
    await proxyManager._monitor_execution_flag(methodObj);
}

async function add_component(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription): Promise<void> {
    const name = lowerFirstLetter(reference.browseName.name || "");
    await proxyManager.getObject(reference.nodeId);
    const childObj = new ObjectExplorer({
        name,
        nodeId: reference.nodeId,
        parent: obj,
        proxyManager
    });
    obj[name] = childObj;
    obj.$components.push(childObj);
    await childObj.$resolve();
}

async function addFolderElement(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription): Promise<void> {

    const name = lowerFirstLetter(reference.browseName.name || "");

    const childObj = new ObjectExplorer({
        name,
        nodeId: reference.nodeId,
        parent: obj,
        proxyManager
    });

    obj[name] = childObj;
    obj.$organizes.push(childObj);
    await childObj.$resolve();
}

async function add_property(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription): Promise<void> {
  
    const name = lowerFirstLetter(reference.browseName.name || "");

    obj[name] = new ProxyVariable(proxyManager, reference.nodeId, reference);
    obj.$properties[name] = obj[name];
}

async function add_typeDefinition(proxyManager: UAProxyManager, obj: any, references: ReferenceDescription[]): Promise<void> {
    references = references || [];
    if (references.length !== 1) {
        return;
    }
    const reference = references[0];
    assert(!obj.typeDefinition, "type definition can only be set once");
    obj.typeDefinition = reference.browseName.name || "";
}

async function addFromState(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription): Promise<void> {
    const childObj = await proxyManager.getObject(reference.nodeId);
    obj.$fromState = childObj;
}

async function addToState(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription): Promise<void> {
    const childObj = await proxyManager.getObject(reference.nodeId);
    obj.$toState = childObj;
}
export class ObjectExplorer  {
    public proxyManager: UAProxyManager;
    public name: string;
    public nodeId: NodeId;
    public parent: any;

    constructor(options: ObjectExplorerOptions) {
        this.proxyManager = options.proxyManager;
        this.name = options.name;
        this.nodeId = options.nodeId;
        this.parent = options.parent;
    }

    public async $resolve(): Promise<void> {
        const childObj = await this.proxyManager.getObject(this.nodeId);
        this.parent[this.name] = childObj;
        this.parent.$components.push(childObj);
    }
}

function t(references: ReferenceDescription[] | null) {
    if (!references) return "";
    return references.map((r: ReferenceDescription) => r.browseName.name + " " + r.nodeId.toString());
}

export async function readUAStructure(proxyManager: UAProxyManager, obj: { nodeId: NodeId }): Promise<ProxyNode> {
    const session = proxyManager.session;

    //   0   Object
    //   1   Variable
    //   2   Method
    const nodeId = obj.nodeId;
    const nodesToBrowse = [
        // 0. Components (except Methods)
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: makeNodeClassMask("Object | Variable"), // we don't want Method here
            nodeId,
            referenceTypeId: makeRefId("HasComponent"),
            resultMask
        },
        // 1. Properties
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            // nodeClassMask: makeNodeClassMask("Variable"),
            nodeId,
            referenceTypeId: makeRefId("HasProperty"),
            resultMask
        },

        // 2.  Methods
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: makeNodeClassMask("Method"),
            nodeId,
            referenceTypeId: makeRefId("HasComponent"),
            resultMask
        },
        // TypeDefinition
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Both,
            includeSubtypes: true,
            nodeId,
            referenceTypeId: makeRefId("HasTypeDefinition"),
            resultMask
        },
        // FromState
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeId,
            referenceTypeId: makeRefId("FromState"),
            resultMask
        },
        // ToState
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeId,
            referenceTypeId: makeRefId("ToState"),
            resultMask
        },
        // (for folders ) Organizes
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeId,
            referenceTypeId: makeRefId("Organizes"),
            resultMask
        }
    ];
    const browseResults = await session.browse(nodesToBrowse);
    // istanbul ignore next
    if (doDebug) {
        debugLog("Components", t(browseResults[0].references));
        debugLog("Properties", t(browseResults[1].references));
        debugLog("Methods", t(browseResults[2].references));
    }

    const promises: Promise<void>[] = [];

    for (const reference of browseResults[0].references || []) {
        promises.push(add_component(proxyManager, obj, reference));
    }
    for (const reference of browseResults[1].references || []) {
        promises.push(add_property(proxyManager, obj, reference));
    }
    for (const reference of browseResults[2].references || []) {
        promises.push(add_method(proxyManager, obj, reference));
    }
    browseResults[3].references &&
        browseResults[3].references.length &&
        promises.push(add_typeDefinition(proxyManager, obj, browseResults[3].references || []));
    browseResults[4].references &&
        browseResults[4].references.length &&
        promises.push(addFromState(proxyManager, obj, browseResults[4].references[0]));
    browseResults[5].references &&
        browseResults[5].references.length &&
        promises.push(addToState(proxyManager, obj, browseResults[5].references[0]));
    for (const reference of browseResults[6].references || []) {
        promises.push(addFolderElement(proxyManager, obj, reference));
    }

    await Promise.all(promises);
    return obj as ProxyNode;
}
