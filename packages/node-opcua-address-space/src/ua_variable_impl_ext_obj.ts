import assert from "node-opcua-assert";
import { BindExtensionObjectOptions, UADataType, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { coerceQualifiedName, NodeClass } from "node-opcua-data-model";
import { getCurrentClock, PreciseClock, coerceClock } from "node-opcua-date-time";
import { DataValue } from "node-opcua-data-value";
import { make_debugLog, make_warningLog, checkDebugFlag, make_errorLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { StructureField } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, VariantLike, VariantArrayType } from "node-opcua-variant";
import { NumericRange } from "node-opcua-numeric-range";

import { UAVariableImpl } from "./ua_variable_impl";
import { UADataTypeImpl } from "./ua_data_type_impl";
import { IndexIterator } from "./idx_iterator";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
// const doDebug = true; // checkDebugFlag(__filename);
// const debugLog = make_warningLog(__filename);
const warningLog = make_warningLog(__filename);
const errorLog = make_errorLog(__filename);

function w(str: string, n: number): string {
    return str.padEnd(n).substring(n);
}

function isProxy(ext: any) {
    return ext.$isProxy ? true : false;
}
function getProxyVariable(ext: any): UAVariable | null {
    assert(isProxy(ext));
    return ext.$variable as UAVariable | null;
}

function getProxyVariableForProp(ext: any, prop: string) {
    const uaVariable = getProxyVariable(ext);
    if (!uaVariable) return undefined;
    return (uaVariable as any)[prop] as UAVariableImpl | undefined;
}

export function getProxyTarget(ext: any): any {
    assert(isProxy(ext));
    const target = ext.$proxyTarget;
    if (target && isProxy(target)) {
        return getProxyTarget(target);
    }
    return target;
}

function unProxy(ext: ExtensionObject) {
    return isProxy(ext) ? getProxyTarget(ext) : ext;
}

function _extensionObjectFieldGetter(getVariable: () => UAVariable | null, target: any, key: string /*, receiver*/) {
    if (key === "$isProxy") {
        return true;
    }
    if (key === "$proxyTarget") {
        return target;
    }
    if (key === "$variable") {
        return getVariable();
    }

    if (target[key] === undefined) {
        return undefined;
    }
    return target[key];
}
function _extensionObjectFieldSetter(
    getVariable: () => UAVariable | null,
    target: any,
    key: string,
    value: any /*, receiver*/
): boolean {
    target[key] = value;
    if (isProxy(target)) {
        return true;
    }
    const uaVariable = getVariable();
    if (!uaVariable) return true;
    const child = (uaVariable as any)[key] as UAVariable | null;
    if (child && child.touchValue) {
        child.touchValue();
    }
    return true; // true means the set operation has succeeded
}

function makeHandler(getVariable: () => UAVariable | null) {
    const handler = {
        get: _extensionObjectFieldGetter.bind(null, getVariable),
        set: _extensionObjectFieldSetter.bind(null, getVariable)
    };
    return handler;
}

/**
 * inconditionnaly change the time stamp of the variable
 * if the variable is being listened to, and if the minimumSamplingInterval is exactly zero,
 * then the change will be reported to the observer
 *
 */
export function _touchValue(property: UAVariableImpl, now: PreciseClock): void {
    property.$dataValue.sourceTimestamp = now.timestamp;
    property.$dataValue.sourcePicoseconds = now.picoseconds;
    property.$dataValue.serverTimestamp = now.timestamp;
    property.$dataValue.serverPicoseconds = now.picoseconds;
    property.$dataValue.statusCode = StatusCodes.Good;
    if (property.listenerCount("value_changed") > 0) {
        property.emit("value_changed", property.$dataValue.clone());
    }
}

export function propagateTouchValueUpward(self: UAVariableImpl, now: PreciseClock, cache?: Set<UAVariable>): void {
    _touchValue(self, now);
    if (self.parent && self.parent.nodeClass === NodeClass.Variable) {
        const parentVar = self.parent as UAVariableImpl;
        if (!parentVar.isExtensionObject()) return;

        if (cache) {
            if (cache.has(parentVar)) return;
            cache.add(parentVar);
        }
        propagateTouchValueUpward(parentVar, now, cache);
    }
}

export function propagateTouchValueDownward(self: UAVariableImpl, now: PreciseClock, cache?: Set<UAVariable>): void {
    if (!self.isExtensionObject()) return;
    // also propagate changes to embeded variables
    const dataTypeNode = self.getDataTypeNode();
    const definition = dataTypeNode.getStructureDefinition();
    for (const field of definition.fields || []) {
        const property = self.getChildByName(field.name!) as UAVariableImpl;

        if (property) {
            if (cache) {
                if (cache.has(property)) {
                    continue;
                }
                cache.add(property);
            }

            _touchValue(property, now);
            // to do cascade recursivelly ?
        }
    }
}

export function setExtensionObjectPartialValue(node: UAVariableImpl, partialObject: any, sourceTimestamp?: PreciseClock) {
    const variablesToUpdate: Set<UAVariableImpl> = new Set();

    const extensionObject = node.$extensionObject;
    if (!extensionObject) {
        throw new Error("setExtensionObjectValue node has no extension object " + node.browseName.toString());
    }

    function _update_extension_object(extObject: any, partialObject1: any) {
        const keys = Object.keys(partialObject1);
        for (const prop of keys) {
            if (extObject[prop] instanceof Object) {
                _update_extension_object(extObject[prop], partialObject1[prop]);
            } else {
                if (isProxy(extObject)) {
                    // collect element we have to update
                    const target = getProxyTarget(extObject);
                    assert(!isProxy(target), "something wierd!");
                    target[prop] = partialObject1[prop];
                    const variable = getProxyVariableForProp(extObject, prop);
                    variable && variablesToUpdate.add(variable as UAVariableImpl);
                } else {
                    extObject[prop] = partialObject1[prop];
                }
            }
        }
    }
    _update_extension_object(extensionObject, partialObject);

    const now = sourceTimestamp || getCurrentClock();
    const cache: Set<UAVariable> = new Set();
    for (const c of variablesToUpdate) {
        if (cache.has(c)) continue;
        propagateTouchValueUpward(c, now, cache);
        propagateTouchValueDownward(c, now, cache);
        cache.add(c);
    }
}

function getOrCreateProperty(
    variableNode: UAVariableImpl,
    field: StructureField,
    options: BindExtensionObjectOptions
): UAVariableImpl | null {
    const dt = variableNode.getDataTypeNode();
    // the namespace for the structure browse name elements
    const structureNamespace = dt.nodeId.namespace;

    const components = variableNode.getComponents();
    let property: UAVariableImpl;
    const selectedComponents = components.filter(
        (f) => f instanceof UAVariableImpl && f.browseName.name!.toString() === field.name
    );

    // istanbul ignore next
    if (field.dataType.value === DataType.Variant) {
        warningLog("Warning : variant is not supported in ExtensionObject");
    }

    if (selectedComponents.length === 1) {
        property = selectedComponents[0] as UAVariableImpl;
        /* istanbul ignore next */
    } else {
        if (!options!.createMissingProp) {
            return null;
        }
        debugLog("adding missing array variable", field.name, variableNode.browseName.toString(), variableNode.nodeId.toString());
        // todo: Handle array appropriately...
        assert(selectedComponents.length === 0);
        // create a variable (Note we may use ns=1;s=parentName/0:PropertyName)
        property = variableNode.namespace.addVariable({
            browseName: { namespaceIndex: structureNamespace, name: field.name!.toString() },
            componentOf: variableNode,
            dataType: field.dataType,
            minimumSamplingInterval: variableNode.minimumSamplingInterval,
            accessLevel: variableNode.accessLevel,
            accessRestrictions: variableNode.accessRestrictions,
            rolePermissions: variableNode.rolePermissions
        }) as UAVariableImpl;
        assert(property.minimumSamplingInterval === variableNode.minimumSamplingInterval);
    }
    return property;
}

function prepareVariantValue(dataType: DataType, value: VariantLike): VariantLike {
    if ((dataType === DataType.Int32 || dataType === DataType.UInt32) && value && (value as { key?: unknown }).key) {
        value = value.value;
    }
    return value;
}

function installExt(uaVariable: UAVariableImpl, ext: ExtensionObject) {
    ext = unProxy(ext);
    uaVariable.$extensionObject = new Proxy(
        ext,
        makeHandler(() => uaVariable)
    );

    const addressSpace = uaVariable.addressSpace;
    const definition = uaVariable.dataTypeObj.getStructureDefinition();
    const structure = addressSpace.findDataType("Structure")!;
    for (const field of definition.fields || []) {
        if (field.dataType) {
            const dataTypeNode = addressSpace.findDataType(field.dataType);
            // istanbul ignore next
            if (dataTypeNode && dataTypeNode.isSubtypeOf(structure)) {
                // sub structure .. let make an handler too
                const camelCaseName = lowerFirstLetter(field.name!);

                const subExtObj = uaVariable.$extensionObject[camelCaseName];
                if (subExtObj) {
                    uaVariable.$extensionObject[camelCaseName] = new Proxy(
                        subExtObj,
                        makeHandler(() => {
                            return uaVariable.getComponentByName(field.name!) as UAVariable | null;
                        })
                    );
                } else {
                    doDebug && warningLog("extension object is null");
                }
            }
        }
    }
}

export function _installExtensionObjectBindingOnProperties(uaVariable: UAVariableImpl, options?: BindExtensionObjectOptions): void {
    // may be extension object mechanism has alreday been install
    // in this case we just need to rebind the properties...
    if (uaVariable.$extensionObject) {
        const extObj = uaVariable.$extensionObject;
        uaVariable.bindExtensionObject(extObj, { createMissingProp: true, force: true });
        return;
    }
    if (uaVariable.$$extensionObjectArray) {
        const extObj = uaVariable.$$extensionObjectArray;
        _bindExtensionObjectArrayOrMatrix(uaVariable, extObj, { createMissingProp: true, force: true });
        return;
    }

    const dataValue = uaVariable.readValue();
    const extObj = dataValue.value.value;
    if (extObj instanceof ExtensionObject) {
        uaVariable.bindExtensionObject(extObj, { createMissingProp: true, force: true });
    } else if (extObj instanceof Array) {
        // istanbul ignore else
        if (dataValue.value.arrayType === VariantArrayType.Array || dataValue.value.arrayType === VariantArrayType.Matrix) {
            _bindExtensionObjectArrayOrMatrix(uaVariable, extObj, { createMissingProp: true, force: true });
        } else {
            throw new Error("Internal Error, unexpected case");
        }
    }
}

function _installFields2(
    uaVariable: UAVariableImpl,
    {
        get,
        set
    }: {
        get: (fieldName: string) => any;
        set: (fieldName: string, value: any, sourceTime: PreciseClock) => void;
    },
    options?: BindExtensionObjectOptions
) {
    options = options || { createMissingProp: false };
    const dt = uaVariable.getDataTypeNode();
    const definition = dt.getStructureDefinition();

    for (const field of definition.fields || []) {
        if (NodeId.sameNodeId(NodeId.nullNodeId, field.dataType)) {
            warningLog("field.dataType is null ! ", field.name, NodeId.nullNodeId.toString());
            warningLog(field.toString());
            warningLog(" dataType replaced with BaseDataType ");
            warningLog(definition.toString());
            field.dataType = uaVariable.resolveNodeId("BaseDataType");
        }

        const propertyNode = getOrCreateProperty(uaVariable, field, options);
        if (!propertyNode) {
            continue;
        }

        propertyNode.$dataValue.statusCode = StatusCodes.Good;
        propertyNode.$dataValue.sourceTimestamp = uaVariable.$dataValue.sourceTimestamp;
        propertyNode.$dataValue.sourcePicoseconds = uaVariable.$dataValue.sourcePicoseconds;
        propertyNode.$dataValue.serverTimestamp = uaVariable.$dataValue.serverTimestamp;
        propertyNode.$dataValue.serverPicoseconds = uaVariable.$dataValue.serverPicoseconds;
        propertyNode.$dataValue.value.dataType = propertyNode.dataTypeObj.basicDataType;
        propertyNode.$dataValue.value.arrayType =
            propertyNode.valueRank === -1
                ? VariantArrayType.Scalar
                : propertyNode.valueRank === 1
                ? VariantArrayType.Array
                : VariantArrayType.Matrix;
        propertyNode.$dataValue.value.dimensions = propertyNode.valueRank > 1 ? propertyNode.arrayDimensions : null;

        const fieldName = field.name!;
        installDataValueGetter(propertyNode, () => get(fieldName));
        assert(propertyNode._inner_replace_dataValue);
        propertyNode._inner_replace_dataValue = (dataValue: DataValue, indexRange?: NumericRange | null) => {
            /** */
            const sourceTime = coerceClock(dataValue.sourceTimestamp, dataValue.sourcePicoseconds);
            const value = dataValue.value.value;
            set(field.name!, value, sourceTime);
            propertyNode.touchValue(sourceTime);
        };

        if (propertyNode.dataTypeObj.basicDataType === DataType.ExtensionObject) {
            _installFields2(
                propertyNode,
                {
                    get: (fieldName: string) => {
                        const mainFieldName = field.name!;
                        return get(mainFieldName)[lowerFirstLetter(fieldName)];
                    },
                    set: (fieldName: string, value: any, sourceTime: PreciseClock) => {
                        const mainFieldName = field.name!;
                        get(mainFieldName)[lowerFirstLetter(fieldName)] = value;
                    }
                },
                options
            );
        }
    }
}

function installDataValueGetter(propertyNode: UAVariableImpl, get: () => any) {
    Object.defineProperty(propertyNode.$dataValue.value, "value", { get });
    const $ = propertyNode.$dataValue;
    Object.defineProperty(propertyNode, "$dataValue", {
        get() {
            return $;
        },
        set: (value) => {
            throw new Error("$dataValue is now frozen and should not be modified this way !\n contact sterfive.com");
        }
    });
}

function isVariableContainingExtensionObject(uaVariable: UAVariableImpl): boolean {
    const addressSpace = uaVariable.addressSpace;
    const structure = addressSpace.findDataType("Structure");

    if (!structure) {
        // the addressSpace is limited and doesn't provide extension object
        // bindExtensionObject cannot be performed and shall finish here.
        return false;
    }

    assert(structure.browseName.toString() === "Structure", "expecting DataType Structure to be in IAddressSpace");

    const dt = uaVariable.getDataTypeNode() as UADataTypeImpl;
    if (!dt.isSubtypeOf(structure)) {
        return false;
    }
    return true;
}

function _innerBindExtensionObjectScalar(
    uaVariable: UAVariableImpl,
    {
        get,
        set,
        setField
    }: {
        get: () => ExtensionObject;
        set: (value: ExtensionObject, sourceTimestamp: PreciseClock, cache: Set<UAVariableImpl>) => void;
        setField: (fieldName: string, value: any, sourceTimestamp: PreciseClock, cache?: Set<UAVariableImpl>) => void;
    },
    options?: BindExtensionObjectOptions
) {
    uaVariable.$dataValue.statusCode = StatusCodes.Good;
    uaVariable.$dataValue.value.dataType = DataType.ExtensionObject;
    uaVariable.$dataValue.value.arrayType = VariantArrayType.Scalar;

    uaVariable.setValueFromSource = function (this: UAVariableImpl, variant: VariantLike) {
        setExtensionObjectPartialValue(this, variant.value);
    };

    installDataValueGetter(uaVariable, get);
    uaVariable.$set_ExtensionObject = set;

    _installFields2(
        uaVariable,
        {
            get: (fieldName: string) => {
                const extObj = get() as any;
                return extObj[lowerFirstLetter(fieldName)];
            },
            set: (fieldName: string, value: any, sourceTime: PreciseClock) => {
                setField(fieldName, value, sourceTime);
            }
        },
        options
    );
}

// eslint-disable-next-line complexity
export function _bindExtensionObject(
    uaVariable: UAVariableImpl,
    optionalExtensionObject?: ExtensionObject,
    options?: BindExtensionObjectOptions
): ExtensionObject | null {
    options = options || { createMissingProp: false };

    // istanbul ignore next
    if (!isVariableContainingExtensionObject(uaVariable)) {
        return null;
    }

    // istanbul ignore next
    if (optionalExtensionObject && uaVariable.valueRank === 0) {
        warningLog(
            uaVariable.browseName.toString() +
                ": valueRank was zero but needed to be adjusted to -1 (Scalar) in bindExtensionObject"
        );
        uaVariable.valueRank = -1;
    }
    const addressSpace = uaVariable.addressSpace;
    let extensionObject_;

    // istanbul ignore next
    if (uaVariable.valueRank !== -1 && uaVariable.valueRank !== 1) {
        throw new Error("Cannot bind an extension object here, valueRank must be scalar (-1) or one-dimensional (1)");
    }

    // istanbul ignore next
    doDebug && debugLog(" ------------------------------ binding ", uaVariable.browseName.toString(), uaVariable.nodeId.toString());

    // ignore bindExtensionObject on sub extension object, bindExtensionObject has to be called from the top most object
    if (
        !options.force &&
        uaVariable.parent &&
        (uaVariable.parent.nodeClass === NodeClass.Variable || uaVariable.parent.nodeClass === NodeClass.VariableType)
    ) {
        const parentDataType = (uaVariable.parent as UAVariable | UAVariableType).dataType;
        const dataTypeNode = addressSpace.findNode(parentDataType) as UADataType;
        const structure = addressSpace.findDataType("Structure")!;
        // istanbul ignore next
        if (dataTypeNode && dataTypeNode.isSubtypeOf(structure)) {
            // warningLog(
            //     "Ignoring bindExtensionObject on sub extension object",
            //     "child=",
            //     self.browseName.toString(),
            //     "parent=",
            //     self.parent.browseName.toString()
            // );
            return null;
        }
    }

    // -------------------- make sure we do not bind a variable twice ....
    if (uaVariable.$extensionObject && !optionalExtensionObject) {
        // istanbul ignore next
        if (!uaVariable.checkExtensionObjectIsCorrect(uaVariable.$extensionObject!)) {
            warningLog(
                "on node : ",
                uaVariable.browseName.toString(),
                uaVariable.nodeId.toString(),
                "dataType=",
                uaVariable.dataType.toString({ addressSpace: uaVariable.addressSpace })
            );
            warningLog(uaVariable.$extensionObject?.toString());
            throw new Error(
                "bindExtensionObject: $extensionObject is incorrect: we are expecting a " +
                    uaVariable.dataType.toString({ addressSpace: uaVariable.addressSpace }) +
                    " but we got a " +
                    uaVariable.$extensionObject?.schema.name
            );
        }
        return uaVariable.$extensionObject;
    }

    // istanbul ignore next
    if (uaVariable.dataTypeObj.isAbstract) {
        warningLog("Warning the DataType associated with this Variable is abstract ", uaVariable.dataTypeObj.browseName.toString());
        warningLog("You need to provide a extension object yourself ");
        throw new Error("bindExtensionObject requires a extensionObject as associated dataType is only abstract");
    }

    const s = uaVariable.readValue();
    if (s.value && s.value.dataType === DataType.ExtensionObject && s.value.value && optionalExtensionObject) {
        // we want to replace the extension object
        s.value.value = null;
    }
    innerBindExtensionObject();
    assert(uaVariable.$extensionObject instanceof Object);
    return uaVariable.$extensionObject;

    function innerBindExtensionObject() {
        if (s.value && (s.value.dataType === DataType.Null || (s.value.dataType === DataType.ExtensionObject && !s.value.value))) {
            if (uaVariable.valueRank === -1 /** Scalar */) {
                extensionObject_ = optionalExtensionObject || addressSpace.constructExtensionObject(uaVariable.dataType, {});

                installExt(uaVariable, extensionObject_);

                _innerBindExtensionObjectScalar(
                    uaVariable,
                    {
                        get: () => uaVariable.$extensionObject,
                        set: (value: ExtensionObject) => installExt(uaVariable, value),
                        setField: (fieldName: string, value: any) => {
                            const extObj = uaVariable.$extensionObject;
                            getProxyTarget(extObj)[lowerFirstLetter(fieldName)] = value;
                        }
                    },
                    options
                );
                return;
            } else if (uaVariable.valueRank === 1 /** Array */) {
                throw new Error("Should not get there ! Please fix me");
            } else {
                errorLog(uaVariable.toString());
                errorLog("Unsupported case ! valueRank= ", uaVariable.valueRank);
            }
        } else {
            // verify that variant has the correct type
            assert(s.value.dataType === DataType.ExtensionObject);
            installExt(uaVariable, s.value.value);
            _innerBindExtensionObjectScalar(
                uaVariable,
                {
                    get: () => uaVariable.$extensionObject,
                    set: (value: ExtensionObject) => installExt(uaVariable, value),
                    setField: (fieldName: string, value: any) => {
                        const extObj = uaVariable.$extensionObject;
                        getProxyTarget(extObj)[lowerFirstLetter(fieldName)] = value;
                    }
                },
                options
            );
        }
    }
}

const getIndexAsText = (index: number | number[]): string => {
    if (typeof index === "number") return `${index}`;
    return `${index.map((a) => a.toString()).join(",")}`;
};
const composeBrowseNameAndNodeId = (uaVariable: UAVariable, indexes: number[]) => {
    const iAsText = getIndexAsText(indexes);
    const browseName = coerceQualifiedName(iAsText);
    let nodeId: NodeId | undefined;
    if (uaVariable.nodeId.identifierType === NodeIdType.STRING) {
        nodeId = new NodeId(NodeIdType.STRING, (uaVariable.nodeId.value as string) + `[${iAsText}]`, uaVariable.nodeId.namespace);
    }
    return { browseName, nodeId };
};

// eslint-disable-next-line max-statements, complexity
export function _bindExtensionObjectArrayOrMatrix(
    uaVariable: UAVariableImpl,
    optionalExtensionObjectArray?: ExtensionObject[],
    options?: BindExtensionObjectOptions
): ExtensionObject[] {
    options = options || { createMissingProp: false };
    options.createMissingProp = options.createMissingProp || false;

    // istanbul ignore next
    if (uaVariable.valueRank < 1) {
        throw new Error("Variable must be a MultiDimensional array");
    }
    const arrayDimensions = uaVariable.arrayDimensions || [];
    // istanbul ignore next
    if (!isVariableContainingExtensionObject(uaVariable)) {
        return [];
    }

    if (!optionalExtensionObjectArray && uaVariable.$dataValue.value.value) {
        assert(Array.isArray(uaVariable.$dataValue.value.value));
        optionalExtensionObjectArray = uaVariable.$dataValue.value.value;
    }

    if (
        (arrayDimensions.length === 0 || (arrayDimensions.length === 1 && arrayDimensions[0] === 0)) &&
        optionalExtensionObjectArray
    ) {
        arrayDimensions[0] = optionalExtensionObjectArray.length;
    }

    const totalLength = arrayDimensions.reduce((p, c) => p * c, 1);

    /** */
    const addressSpace = uaVariable.addressSpace;
    if (optionalExtensionObjectArray) {
        if (optionalExtensionObjectArray.length !== totalLength) {
            throw new Error(
                `optionalExtensionObjectArray must have the expected number of element matching ${arrayDimensions} but was ${optionalExtensionObjectArray.length}`
            );
        }
    }
    if (!optionalExtensionObjectArray) {
        optionalExtensionObjectArray = [];
        for (let i = 0; i < totalLength; i++) {
            optionalExtensionObjectArray[i] = addressSpace.constructExtensionObject(uaVariable.dataType, {});
        }
    }
    uaVariable.$$extensionObjectArray = optionalExtensionObjectArray;
    uaVariable.$dataValue.value.arrayType = uaVariable.valueRank === 1 ? VariantArrayType.Array : VariantArrayType.Matrix;
    uaVariable.$dataValue.value.dimensions = uaVariable.valueRank === 1 ? null : uaVariable.arrayDimensions || [];
    uaVariable.$dataValue.value.dataType = DataType.ExtensionObject;
    uaVariable.$dataValue.value.value = uaVariable.$$extensionObjectArray;

    // make sure uaVariable.$dataValue cannot be inadvertantly changed from this point onward
    const $dataValue = uaVariable.$dataValue;
    Object.defineProperty(uaVariable, "$dataValue", {
        get(): DataValue {
            return $dataValue;
        },
        set() {
            throw new Error("$dataValue is now sealed , you should not change internal $dataValue!");
        },
        //    writable: true,
        enumerable: true,
        configurable: true
    });

    uaVariable.bindVariable(
        {
            get: () => uaVariable.$dataValue.value
        },
        true
    );

    const namespace = uaVariable.namespace;
    const indexIterator = new IndexIterator(arrayDimensions);
    for (let i = 0; i < totalLength; i++) {
        const index = indexIterator.next();

        const { browseName, nodeId } = composeBrowseNameAndNodeId(uaVariable, index);

        let uaElement = uaVariable.getComponentByName(browseName) as UAVariableImpl | null;
        if (!uaElement) {
            if (!options.createMissingProp) {
                continue;
            }

            uaElement = namespace.addVariable({
                browseName,
                nodeId,
                componentOf: uaVariable,
                dataType: uaVariable.dataType,
                valueRank: -1,
                accessLevel: uaVariable.accessLevel
            }) as UAVariableImpl;
        }

        uaElement.$dataValue.statusCode = StatusCodes.Good;
        uaElement.$dataValue.sourceTimestamp = uaVariable.$dataValue.sourceTimestamp;
        uaElement.$dataValue.sourcePicoseconds = uaVariable.$dataValue.sourcePicoseconds;
        uaElement.$dataValue.serverTimestamp = uaVariable.$dataValue.serverTimestamp;
        uaElement.$dataValue.serverPicoseconds = uaVariable.$dataValue.serverPicoseconds;
        uaElement.$dataValue.value.dataType = DataType.ExtensionObject;
        uaElement.$dataValue.value.arrayType = VariantArrayType.Scalar;

        {
            const capturedIndex = i;
            const capturedUaElement = uaElement as UAVariableImpl;
            _innerBindExtensionObjectScalar(
                uaElement,
                {
                    get: () => uaVariable.$$extensionObjectArray[capturedIndex],
                    set: (newValue: ExtensionObject, sourceTimestamp: PreciseClock, cache: Set<UAVariableImpl>) => {
                        assert(!isProxy(uaVariable.$$extensionObjectArray[capturedIndex]));
                        uaVariable.$$extensionObjectArray[capturedIndex] = newValue;
                        // istanbul ignore next
                        if (uaVariable.$$extensionObjectArray !== uaVariable.$dataValue.value.value) {
                            warningLog("uaVariable", uaVariable.nodeId.toString());
                            warningLog("Houston! We have a problem ");
                        }
                        propagateTouchValueDownward(capturedUaElement, sourceTimestamp, cache);
                        propagateTouchValueUpward(capturedUaElement, sourceTimestamp, cache);
                    },
                    setField: (fieldName: string, newValue: any, sourceTimestamp: PreciseClock, cache?: Set<UAVariableImpl>) => {
                        // istanbul ignore next doDebug && debugLog("setField", fieldName, newValue, sourceTimestamp, cache);
                        const extObj = uaVariable.$$extensionObjectArray[capturedIndex];
                        (isProxy(extObj) ? getProxyTarget(extObj) : extObj)[lowerFirstLetter(fieldName)] = newValue;
                        propagateTouchValueUpward(capturedUaElement, sourceTimestamp, cache);
                    }
                },
                { ...options, force: true }
            );
        }
    }
    return uaVariable.$$extensionObjectArray;
}

export function getElement(path: string | string[], data: any) {
    if (typeof path === "string") {
        path = path.split(".");
    }
    let a = data;
    for (const e of path) {
        a = a[e];
    }
    return a;
}
export function setElement(path: string | string[], data: any, value: any) {
    if (typeof path === "string") {
        path = path.split(".");
    }
    const last: string = path.pop()!;
    let a = data;
    for (const e of path) {
        a = a[e];
    }
    a[last] = value;
}
export function incrementElement(path: string | string[], data: any) {
    const value = getElement(path, data);
    setElement(path, data, value + 1);
}
export function extractPartialData(path: string | string[], extensionObject: ExtensionObject) {
    let name;
    if (typeof path === "string") {
        path = path.split(".");
    }
    assert(path instanceof Array);
    let i;
    // read partial value
    const partialData: any = {};
    let p: any = partialData;
    for (i = 0; i < path.length - 1; i++) {
        name = path[i];
        p[name] = {};
        p = p[name];
    }
    name = path[path.length - 1];
    p[name] = 0;

    let c1 = partialData;
    let c2: any = extensionObject;

    for (i = 0; i < path.length - 1; i++) {
        name = path[i];
        c1 = partialData[name];
        c2 = (extensionObject as any)[name];
    }
    name = path[path.length - 1];
    c1[name] = c2[name];
    return partialData;
}

export function propagateTouchValueDownwardArray(uaVariable: UAVariableImpl, now: PreciseClock, cache: Set<UAVariable>) {
    if (!uaVariable.$$extensionObjectArray) return;
    const arrayDimensions = uaVariable.arrayDimensions || [];
    const totalLength = uaVariable.$$extensionObjectArray.length;

    const indexIterator = new IndexIterator(arrayDimensions);
    for (let i = 0; i < totalLength; i++) {
        const index = indexIterator.next();

        const { browseName, nodeId } = composeBrowseNameAndNodeId(uaVariable, index);
        const uaElement = uaVariable.getComponentByName(browseName) as UAVariableImpl | null;
        if (uaElement?.nodeClass === NodeClass.Variable) {
            uaElement.touchValue(now);
            propagateTouchValueDownward(uaElement, now, cache);
        }
    }
}
