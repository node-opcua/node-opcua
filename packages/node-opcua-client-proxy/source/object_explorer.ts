/**
 * @module node-opcua-client-proxy
 */
import * as async from "async";

import { assert } from "node-opcua-assert";
import { Callback, ErrorCallback } from "node-opcua-status-code";
import { AttributeIds, BrowseDirection, makeNodeClassMask, makeResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSession, ArgumentDefinition } from "node-opcua-pseudo-session";
import { BrowseResult, ReferenceDescription } from "node-opcua-service-browse";
import { CallMethodRequest, CallMethodResult, Argument } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant, VariantArrayType, VariantLike } from "node-opcua-variant";
import { make_errorLog, make_debugLog } from "node-opcua-debug";

import { makeRefId } from "./proxy";
import { UAProxyManager } from "./proxy_manager";
import { ProxyVariable } from "./proxy_variable";
import { MethodDescription, ArgumentEx } from "./proxy_base_node";
import { DataTypeIds } from "node-opcua-constants";

const doDebug = false;
const errorLog = make_errorLog("Proxy");
const debugLog = make_debugLog("Proxy");

export interface ObjectExplorerOptions {
    proxyManager: UAProxyManager;
    name: string;
    nodeId: NodeId;
    parent: any;
}

const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");

/**
 * @method convertNodeIdToDataTypeAsync
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
function convertNodeIdToDataTypeAsync(session: IBasicSession, dataTypeId: NodeId, callback: Callback<DataType>) {
    const nodeToRead = {
        attributeId: AttributeIds.BrowseName,
        nodeId: dataTypeId
    };
    session.read(nodeToRead, (err: Error | null, dataValue?: DataValue) => {
        // istanbul ignore next
        if (err) {
            setImmediate(() => {
                callback(err);
            });
            return;
        }

        dataValue = dataValue!;

        let dataType: DataType;
        // istanbul ignore next
        if (dataValue.statusCode !== StatusCodes.Good) {
            dataType = DataType.Null;
            setImmediate(() => {
                callback(null, dataType);
            });
            return;
        }

        const dataTypeName = dataValue.value.value;

        if (dataTypeId.namespace === 0 && dataTypeId.value === DataTypeIds.Enumeration) {
            dataType = DataType.Int32;
            setImmediate(() => {
                callback(null, dataType);
            });
            return;
        }

        if (dataTypeId.namespace === 0 && DataType[dataTypeId.value as number]) {
            dataType = (DataType as any)[dataTypeId.value as number] as DataType;
            setImmediate(() => {
                callback(null, dataType);
            });
            return;
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
        session.browse(nodeToBrowse, (err: Error | null, browseResult?: BrowseResult) => {
            // istanbul ignore next
            if (err) {
                return callback(err);
            }

            const references = browseResult!.references;

            if (!references || references.length !== 1) {
                return callback(new Error("cannot find SuperType of " + dataTypeName.toString()));
            }
            const nodeId = references[0].nodeId;
            return convertNodeIdToDataTypeAsync(session, nodeId, callback);
        });
    });
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

const thenify =require("thenify");
 
function makeFunction(obj: any, methodName: string) {
    return thenify.withCallback(function functionCaller(
        this: any,
        inputArgs: Record<string, unknown>,
        callback: (err: Error | null, output?: Record<string, unknown>) => void
    ) {
        const session = this.proxyManager.session;

        assert(typeof callback === "function");

        const methodDef = this.$methods[methodName];
        // convert input arguments into Variants
        const inputArgsDef = methodDef.inputArguments || [];

        const inputArguments: Variant[] = convertToVariantArray(inputArgsDef, inputArgs);

        const methodToCall = new CallMethodRequest({
            inputArguments,
            methodId: methodDef.nodeId,
            objectId: obj.nodeId
        });

        session.call(methodToCall, (err: Error | null, callResult?: CallMethodResult) => {
            // istanbul ignore next
            if (err) {
                return callback(err);
            }

            callResult = callResult!;

            if (callResult.statusCode !== StatusCodes.Good) {
                return callback(new Error("Error " + callResult.statusCode.toString()));
            }

            callResult.outputArguments = callResult.outputArguments || [];

            if (callResult.outputArguments.length !== methodDef.outputArguments.length) {
                return callback(
                    new Error(
                        "Internal error callResult.outputArguments.length " +
                            callResult.outputArguments.length +
                            " " +
                            obj[methodName].outputArguments.length
                    )
                );
            }
            const output: Record<string, unknown> = {};
            methodDef.outputArguments.map((arg: Argument, index: number) => {
                const variant = callResult!.outputArguments![index];
                const propName = lowerFirstLetter(arg.name!);
                output[propName] = variant.value;
            });

            callback(err, output);
        });
    });
}

function extractDataType(session: IBasicSession, arg: ArgumentEx, callback: ErrorCallback): void {
    if (arg.dataType && arg._basicDataType) {
        setImmediate(callback); // already converted
        return;
    }

    convertNodeIdToDataTypeAsync(session, arg.dataType, (err?: Error | null, dataType?: DataType) => {
        if (!err) {
            arg._basicDataType = dataType!;
        }
        callback(err || undefined);
    });
}
/**
 * @method add_method
 * @private
 */
function add_method(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription, outerCallback: (err?: Error) => void) {
    const session = proxyManager.session;

    const methodName = lowerFirstLetter(reference.browseName.name!);

    let inputArguments: ArgumentEx[] = [];
    let outputArguments: ArgumentEx[] = [];

    // tslint:disable:no-shadowed-variable
    async.series(
        [
            (callback: ErrorCallback) => {
                session.getArgumentDefinition(reference.nodeId, (err, argumentDefinition) => {
                    // istanbul ignore next
                    if (err) {
                        errorLog("getArgumentDefinition failed ", err);
                        return callback(err);
                    }
                    // istanbul ignore next
                    if (!argumentDefinition) {
                        return callback(new Error("Internal Error"));
                    }
                    inputArguments = (argumentDefinition.inputArguments as ArgumentEx[]) || [];
                    outputArguments = (argumentDefinition.outputArguments as ArgumentEx[]) || [];

                    const _extractDataType = extractDataType.bind(null, session);
                    async.series(
                        [
                            (innerCallback) => async.eachSeries(inputArguments, _extractDataType, innerCallback),
                            (innerCallback) => async.eachSeries(outputArguments, _extractDataType, innerCallback)
                        ],
                        (err) => callback(err!)
                    );
                });
            },

            (callback: ErrorCallback) => {
                
                const methodObj: MethodDescription = {
                    browseName: methodName,
                    executableFlag: false,
                    func: makeFunction(obj, methodName),
                    nodeId: reference.nodeId,
                    inputArguments,
                    outputArguments
                };
                obj.$methods[methodName] = methodObj;
                obj[methodName] = methodObj.func;

                obj[methodName].inputArguments = inputArguments;
                obj[methodName].outputArguments = outputArguments;

                doDebug && debugLog("installing method name", methodName);
                proxyManager._monitor_execution_flag(methodObj, () => {
                    callback();
                });
            }
        ],
        (err) => {
            if (err) {
                errorLog("Error =>",err);
            }
            outerCallback(err!)
        }
    );
}

function add_component(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription, callback: (err?: Error) => void) {
    const session = proxyManager.session;

    const name = lowerFirstLetter(reference.browseName.name || "");

    proxyManager.getObject(reference.nodeId, (err?: Error | null, childObj?: any) => {
        // istanbul ignore else
        if (!err) {
            childObj = new ObjectExplorer({
                name,
                nodeId: reference.nodeId,
                parent: obj,
                proxyManager
            });
            obj[name] = childObj;
            obj.$components.push(childObj);

            childObj.$resolve(callback);
        } else {
            callback(err);
        }
    });
}

function addFolderElement(
    proxyManager: UAProxyManager,
    obj: any,
    reference: ReferenceDescription,
    callback: (err?: Error) => void
) {
    const session = proxyManager.session;

    const name = lowerFirstLetter(reference.browseName.name || "");

    const childObj = new ObjectExplorer({
        name,
        nodeId: reference.nodeId,
        parent: obj,
        proxyManager
    });

    obj[name] = childObj;
    obj.$organizes.push(childObj);
    childObj.$resolve(callback);
}

function add_property(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription, callback: (err?: Error) => void) {
    const session = proxyManager.session;

    const name = lowerFirstLetter(reference.browseName.name || "");

    obj[name] = new ProxyVariable(proxyManager, reference.nodeId, reference);
    obj.$properties[name] = obj[name];

    setImmediate(callback);
}

function add_typeDefinition(
    proxyManager: UAProxyManager,
    obj: any,
    references: ReferenceDescription[],
    callback: (err?: Error) => void
): void {
    const session = proxyManager.session;
    references = references || [];
    if (references.length !== 1) {
        setImmediate(callback);
        return;
    }
    const reference = references[0];
    assert(!obj.typeDefinition, "type definition can only be set once");
    obj.typeDefinition = reference.browseName.name || "";
    setImmediate(callback);
}

function addFromState(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription, callback: (err?: Error) => void) {
    proxyManager.getObject(reference.nodeId, (err: Error | null, childObj: any) => {
        if (err) {
            callback(err);
        }
        obj.$fromState = childObj;
        callback();
    });
}

function addToState(proxyManager: UAProxyManager, obj: any, reference: ReferenceDescription, callback: (err?: Error) => void) {
    proxyManager.getObject(reference.nodeId, (err: Error | null, childObj: any) => {
        if (err) {
            callback(err);
        }
        obj.$toState = childObj;
        callback();
    });
}

export class ObjectExplorer {
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

    public $resolve(callback: (err?: Error) => void): void {
        this.proxyManager.getObject(this.nodeId, (err: Error | null, childObj: any) => {
            // istanbul ignore next
            if (err) {
                return callback(err);
            }

            this.parent[this.name] = childObj;
            this.parent.$components.push(childObj);

            callback();
        });
    }
}
function t(references: ReferenceDescription[] | null) {
    if (!references) return "";
    return references.map((r: ReferenceDescription) => r.browseName.name + " " + r.nodeId.toString());
}

export function readUAStructure(proxyManager: UAProxyManager, obj: { nodeId: NodeId }, callback: ErrorCallback): void {
    const session = proxyManager.session;

    //   0   Object
    //   1   Variable
    //   2   Method
    const nodeId = obj.nodeId;
    const nodesToBrowse = [
        // Components (except Methods)
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: makeNodeClassMask("Object | Variable"), // we don't want Method here
            nodeId,
            referenceTypeId: makeRefId("HasComponent"),
            resultMask
        },
        // Properties
        {
            // BrowseDescription
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            // nodeClassMask: makeNodeClassMask("Variable"),
            nodeId,
            referenceTypeId: makeRefId("HasProperty"),
            resultMask
        },

        // Methods
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
    session.browse(nodesToBrowse, (err: Error | null, browseResults?: BrowseResult[]) => {
        browseResults = browseResults || [];

        // istanbul ignore next
        if (err) {
            return callback(err);
        }

        if (doDebug) {
            debugLog("Components", t(browseResults[0].references));
            debugLog("Properties", t(browseResults[1].references));
            debugLog("Methods", t(browseResults[2].references));
        }
        async.series(
            [
                (callback: ErrorCallback) => {
                    async.mapSeries(
                        browseResults![0].references!,
                        (reference, innerCallback) => add_component(proxyManager, obj, reference, innerCallback),
                        (err) => callback(err!)
                    );
                },

                (callback: ErrorCallback) => {
                    async.mapSeries(
                        browseResults![1].references!,
                        (reference, innerCallback) => add_property(proxyManager, obj, reference, innerCallback),
                        (err) => callback(err!)
                    );
                },

                // now enrich our object with nice callable async methods
                (callback: ErrorCallback) => {
                    async.mapSeries(
                        browseResults![2].references!,
                        (reference, innerCallback) => add_method(proxyManager, obj, reference, innerCallback),
                        (err) => callback(err!)
                    );
                },

                // now set typeDefinition
                (callback: ErrorCallback) => {
                    add_typeDefinition(proxyManager, obj, browseResults![3].references!, callback);
                },

                // FromState
                (callback: ErrorCallback) => {
                    // fromState
                    const reference = browseResults![4].references ? browseResults![4].references![0] : null;
                    // fromState
                    if (reference) {
                        return addFromState(proxyManager, obj, reference, callback);
                    }
                    callback();
                },

                // ToState
                (callback: ErrorCallback) => {
                    const reference = browseResults![5].references ? browseResults![5].references![0] : null;
                    // fromState
                    if (reference) {
                        return addToState(proxyManager, obj, reference, callback);
                    }
                    callback();
                },

                // Organizes
                (callback: ErrorCallback) => {
                    async.mapSeries(
                        browseResults![6].references!,
                        (reference: ReferenceDescription, callback: ErrorCallback) =>
                            addFolderElement(proxyManager, obj, reference, callback),
                        (err) => callback(err!)
                    );
                }
            ],
            (err) => callback(err!)
        );
    });
}
