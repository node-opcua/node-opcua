import * as chalk from "chalk";
import assert from "node-opcua-assert";
import { BindExtensionObjectOptions, UADataType, UADynamicVariableArray, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { coerceQualifiedName, NodeClass } from "node-opcua-data-model";
import { getCurrentClock, PreciseClock, DateWithPicoseconds, coerceClock } from "node-opcua-date-time";
import { DataValue } from "node-opcua-data-value";
import { make_debugLog, make_warningLog, checkDebugFlag, make_errorLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { coerceNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { StatusCodes, CallbackT, StatusCode } from "node-opcua-status-code";
import { StructureField } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant, VariantLike, VariantArrayType } from "node-opcua-variant";

import { valueRankToString } from "./base_node_private";
import { UAVariableImpl } from "./ua_variable_impl";
import { UADataTypeImpl } from "./ua_data_type_impl";
import { bindExtObjArrayNode } from "./extension_object_array_node";
import { IndexIterator } from "./idx_iterator";
import { DateTime } from "node-opcua-basic-types";

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

function getProxyTarget(ext: any) {
    assert(isProxy(ext));
    return ext.$proxyTarget;
}

function unProxy(ext: ExtensionObject) {
    return isProxy(ext) ? getProxyTarget(ext) : ext;
}

function _extensionObjectFieldGetter(target: any, key: string /*, receiver*/) {
    if (key === "$isProxy") {
        return true;
    }
    if (key === "$proxyTarget") {
        return target;
    }
    if (target[key] === undefined) {
        return undefined;
    }
    return target[key];
}

function _extensionObjectFieldSetter(variable: UAVariable, target: any, key: string, value: any /*, receiver*/): boolean {
    target[key] = value;
    const child = (variable as any)[key] as UAVariable | null;
    if (child && child.touchValue) {
        child.touchValue();
    }
    return true; // true means the set operation has succeeded
}

function makeHandler(variable: UAVariable) {
    const handler = {
        get: _extensionObjectFieldGetter,
        set: _extensionObjectFieldSetter.bind(null, variable)
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

    if (property.minimumSamplingInterval === 0) {
        if (property.listenerCount("value_changed") > 0) {
            const clonedDataValue = property.readValue();
            property.emit("value_changed", clonedDataValue);
        }
    }
}

export function propagateTouchValueUpward(self: UAVariableImpl, now: PreciseClock): void {
    _touchValue(self, now);
    if (self.parent && self.parent.nodeClass === NodeClass.Variable) {
        const parentVar = self.parent as UAVariableImpl;
        if (!parentVar.isExtensionObject()) return;
        propagateTouchValueUpward(parentVar, now);
    }
}

function propagateTouchValueDownward(self: UAVariableImpl, now: PreciseClock): void {
    if (!self.isExtensionObject()) return;
    // also propagate changes to embeded variables
    const dataTypeNode = self.getDataTypeNode();
    const definition = dataTypeNode.getStructureDefinition();
    for (const field of definition.fields || []) {
        const property = self.getChildByName(field.name!) as UAVariableImpl;
        if (property) {
            _touchValue(property, now);
            // to do cascade recursivelly ?
        }
    }
}

export function _setExtensionObject(self: UAVariableImpl, ext: ExtensionObject | ExtensionObject[], sourceTimestamp?: PreciseClock): void {
    // assert(!(ext as any).$isProxy, "internal error ! ExtensionObject has already been proxied !");
    if (Array.isArray(ext)) {
        assert(self.valueRank === 1, "Only Array is supported for the time being");
        ext = ext.map((e) => unProxy(e));
        self.$dataValue.value.arrayType = VariantArrayType.Array;
        self.$extensionObject = ext.map((e) => new Proxy(e, makeHandler(self)));
        self.$dataValue.value.dataType = DataType.ExtensionObject;
        self.$dataValue.value.value = self.$extensionObject;
        self.$dataValue.statusCode = StatusCodes.Good;
        return;
    } else {
        ext = unProxy(ext);
        self.$extensionObject = new Proxy(ext, makeHandler(self));
        self.$dataValue.value.dataType = DataType.ExtensionObject;
        self.$dataValue.value.value = self.$extensionObject;
        self.$dataValue.statusCode = StatusCodes.Good;
    }

    const now = sourceTimestamp || getCurrentClock();
    propagateTouchValueUpward(self, now);
    propagateTouchValueDownward(self, now);
}

export function setExtensionObjectValue(node: UAVariableImpl, partialObject: any) {
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
                extObject[prop] = partialObject1[prop];
            }
        }
    }

    _update_extension_object(extensionObject, partialObject);
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

function bindProperty(variableNode: UAVariableImpl, propertyNode: UAVariableImpl, name: string, dataType: DataType) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    propertyNode.bindVariable(
        {
            timestamped_get: () => {
                const propertyValue = variableNode.$extensionObject[name];
                if (propertyValue === undefined) {
                    propertyNode.$dataValue.value.dataType = DataType.Null;
                    propertyNode.$dataValue.statusCode = StatusCodes.Good;
                    propertyNode.$dataValue.value.value = null;
                    return new DataValue(propertyNode.$dataValue);
                }
                const value = prepareVariantValue(dataType, propertyValue);
                propertyNode.$dataValue.statusCode = StatusCodes.Good;
                propertyNode.$dataValue.value.dataType = dataType;
                propertyNode.$dataValue.value.value = value;
                return new DataValue(propertyNode.$dataValue);
            },
            timestamped_set: (_dataValue: DataValue, callback: CallbackT<StatusCode>) => {

                propertyNode.setValueFromSource(_dataValue.value, _dataValue.statusCode, _dataValue.sourceTimestamp || new Date());
                // callback(null, StatusCodes.BadNotWritable);
                callback(null, StatusCodes.Good);
            }
        },
        true
    );
}


function _initial_setup(variableNode: UAVariableImpl) {
    const dataValue = variableNode.readValue();
    const extObj = dataValue.value.value;
    if (extObj instanceof ExtensionObject) {
        variableNode.bindExtensionObject(extObj, { createMissingProp: true, force: true });
    } else if (extObj instanceof Array) {
        if (dataValue.value.arrayType === VariantArrayType.Array) {
            variableNode.bindExtensionObjectArray(extObj, { createMissingProp: true, force: true });
        } else if (dataValue.value.arrayType === VariantArrayType.Matrix) {
            _bindExtensionObjectMatrix(variableNode, extObj, { createMissingProp: true, force: true });
        } else {
            throw new Error("Internal Error, unexpected case");
        }
    } else {
        const msg = `variableNode ${variableNode.browseName.toString()} doesn't have $extensionObject property`;
        errorLog(msg);
        errorLog(dataValue.toString());
        throw new Error(msg);
    }
}
export function _installExtensionObjectBindingOnProperties(
    variableNode: UAVariableImpl,
    options: BindExtensionObjectOptions
): void {

    if (!variableNode.$extensionObject) {
        _initial_setup(variableNode);
        return;
    }
    const addressSpace = variableNode.addressSpace;
    const dt = variableNode.getDataTypeNode();
    const definition = dt.getStructureDefinition();

    for (const field of definition.fields || []) {
        // istanbul ignore next
        if (NodeId.sameNodeId(NodeId.nullNodeId, field.dataType)) {
            warningLog("field.dataType is null ! ", field.name, NodeId.nullNodeId.toString());
            warningLog(field.toString());
            warningLog(" dataType replaced with BaseDataType ");
            warningLog(definition.toString());
            field.dataType = variableNode.resolveNodeId("BaseDataType");
        }

        const propertyNode = getOrCreateProperty(variableNode, field, options);
        if (!propertyNode) {
            continue;
        }
        propertyNode.$dataValue.statusCode = StatusCodes.Good;
        propertyNode.$dataValue.sourceTimestamp = variableNode.$dataValue.sourceTimestamp;
        propertyNode.$dataValue.sourcePicoseconds = variableNode.$dataValue.sourcePicoseconds;
        propertyNode.$dataValue.serverTimestamp = variableNode.$dataValue.serverTimestamp;
        propertyNode.$dataValue.serverPicoseconds = variableNode.$dataValue.serverPicoseconds;

        //xx propertyNode.touchValue();

        const basicDataType = addressSpace.findCorrespondingBasicDataType(field.dataType);

        // istanbul ignore next
        if (doDebug) {
            const x = addressSpace.findNode(field.dataType)!.browseName.toString();
            debugLog(
                chalk.cyan("xxx"),
                " dataType",
                w(field.dataType.toString(), 8),
                w(field.name!, 25),
                "valueRank",
                chalk.cyan(w(valueRankToString(field.valueRank), 10)),
                chalk.green(w(x, 15)),
                "basicType = ",
                chalk.yellow(w(basicDataType.toString(), 20)),
                propertyNode.nodeId.toString(),
                propertyNode.readValue().statusCode.toString()
            );
        }

        const camelCaseName = lowerFirstLetter(field.name!);
        // assert(Object.prototype.hasOwnProperty.call(variableNode.$extensionObject, camelCaseName));

        if (variableNode.$extensionObject[camelCaseName] !== undefined && basicDataType === DataType.ExtensionObject) {
            propertyNode.bindExtensionObject(variableNode.$extensionObject[camelCaseName], { ...options, force: true });
            // replace upwards
            variableNode.$extensionObject[camelCaseName] = propertyNode.$extensionObject;
        } else {
            const prop = variableNode.$extensionObject[camelCaseName];
            if (prop === undefined) {
                propertyNode._internal_set_value(
                    new Variant({
                        dataType: DataType.Null
                    })
                );
            } else {
                const preparedValue = prepareVariantValue(basicDataType, prop);
                propertyNode._internal_set_value(
                    new Variant({
                        dataType: basicDataType,
                        value: preparedValue
                    })
                );
            }

            // eslint-disable-next-line @typescript-eslint/no-this-alias

            //  property.camelCaseName = camelCaseName;
            propertyNode.setValueFromSource = function (this: UAVariableImpl, variant: VariantLike) {
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                const inner_this = this;
                const variant1 = Variant.coerce(variant);
                inner_this.verifyVariantCompatibility(variant1);

                // because self.$extensionObject is a Proxy with handlers that
                // cascade the chagne we do not need to call touchValue() here
                variableNode.$extensionObject[camelCaseName] = variant1.value;
            };
        }
        assert(propertyNode.readValue().statusCode.equals(StatusCodes.Good));
        bindProperty(variableNode, propertyNode, camelCaseName, basicDataType);
    }
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
    if (!dt.isSupertypeOf(structure)) {
        return false;
    }
    return true;

}
// eslint-disable-next-line complexity
export function _bindExtensionObject(
    self: UAVariableImpl,
    optionalExtensionObject?: ExtensionObject | ExtensionObject[],
    options?: BindExtensionObjectOptions
): ExtensionObject | ExtensionObject[] | null {
    options = options || { createMissingProp: false };

    if (!isVariableContainingExtensionObject(self)) {
        return null;
    }
    const addressSpace = self.addressSpace;
    let extensionObject_;

    if (self.valueRank !== -1 && self.valueRank !== 1) {
        throw new Error("Cannot bind an extension object here, valueRank must be scalar (-1) or one-dimensional (1)");
    }

    // istanbul ignore next
    if (doDebug) {
        debugLog(" ------------------------------ binding ", self.browseName.toString(), self.nodeId.toString());
    }

    // ignore bindExtensionObject on sub extension object, bindExtensionObject has to be called from the top most object
    if (
        !options.force &&
        self.parent &&
        (self.parent.nodeClass === NodeClass.Variable || self.parent.nodeClass === NodeClass.VariableType)
    ) {
        const parentDataType = (self.parent as UAVariable | UAVariableType).dataType;
        const dataTypeNode = addressSpace.findNode(parentDataType) as UADataType;
        const structure = addressSpace.findDataType("Structure")!;
        // istanbul ignore next
        if (dataTypeNode && dataTypeNode.isSupertypeOf(structure)) {
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
    if (self.$extensionObject && !optionalExtensionObject) {
        // istanbul ignore next
        if (!self.checkExtensionObjectIsCorrect(self.$extensionObject!)) {
            warningLog(
                "on node : ",
                self.browseName.toString(),
                self.nodeId.toString(),
                "dataType=",
                self.dataType.toString({ addressSpace: self.addressSpace })
            );
            warningLog(self.$extensionObject?.toString());
            throw new Error(
                "bindExtensionObject: $extensionObject is incorrect: we are expecting a " +
                self.dataType.toString({ addressSpace: self.addressSpace }) +
                " but we got a " +
                self.$extensionObject?.constructor.name
            );
        }
        return self.$extensionObject;
        // throw new Error("Variable already bound");
    }

    // ------------------------------------------------------
    // make sure we have a structure
    // ------------------------------------------------------
    const s = self.readValue();

    // istanbul ignore next
    if (self.dataTypeObj.isAbstract) {
        warningLog("Warning the DataType associated with this Variable is abstract ", self.dataTypeObj.browseName.toString());
        warningLog("You need to provide a extension object yourself ");
        throw new Error("bindExtensionObject requires a extensionObject as associated dataType is only abstract");
    }

    if (s.value && s.value.dataType === DataType.ExtensionObject && s.value.value && optionalExtensionObject) {
        // we want to replace the extension object
        s.value.value = null;
    }
    innerBindExtensionObject();
    assert(self.$extensionObject instanceof Object);
    return self.$extensionObject;

    function innerBindExtensionObject() {
        const makePreciseClock = (sourceTimestamp: DateTime, picoseconds?: number): PreciseClock =>
            ({ timestamp: sourceTimestamp as DateWithPicoseconds, picoseconds: picoseconds || 0 });


        if (s.value && (s.value.dataType === DataType.Null || (s.value.dataType === DataType.ExtensionObject && !s.value.value))) {
            if (self.valueRank === -1 /** Scalar */) {
                // create a structure and bind it
                extensionObject_ = optionalExtensionObject || addressSpace.constructExtensionObject(self.dataType, {});
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                self.bindVariable(
                    {
                        timestamped_get() {
                            const d = new DataValue(self.$dataValue);
                            d.value.value = self.$extensionObject ? self.$extensionObject.clone() : null;
                            return d;
                        },
                        timestamped_set(dataValue: DataValue, callback: CallbackT<StatusCode>) {
                            const ext = dataValue.value.value;
                            if (!self.checkExtensionObjectIsCorrect(ext)) {
                                return callback(null, StatusCodes.BadInvalidArgument);
                            }
                            const sourceTime = coerceClock(dataValue.sourceTimestamp, dataValue.sourcePicoseconds);
                            _setExtensionObject(self, ext, sourceTime);
                            callback(null, StatusCodes.Good);
                        }
                    },
                    true
                );
                const sourceTime = coerceClock(self.$dataValue.sourceTimestamp, self.$dataValue.sourcePicoseconds);
                _setExtensionObject(self, extensionObject_, sourceTime);

            } else if (self.valueRank === 1 /** Array */) {
                // create a structure and bind it

                extensionObject_ = optionalExtensionObject || [];
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                self.bindVariable(
                    {
                        timestamped_get() {
                            const d = new DataValue(self.$dataValue);

                            d.value.value = self.$extensionObject
                                ? self.$extensionObject.map((e: ExtensionObject) => e.clone())
                                : null;
                            return d;
                        },
                        timestamped_set(dataValue: DataValue, callback: CallbackT<StatusCode>) {
                            const extensionObjectArray = dataValue.value.value;
                            if (!self.checkExtensionObjectIsCorrect(extensionObjectArray)) {
                                return callback(null, StatusCodes.BadInvalidArgument);
                            }
                            const sourceTime = coerceClock(dataValue.sourceTimestamp, dataValue.sourcePicoseconds);
                            _setExtensionObject(self, extensionObjectArray, sourceTime);
                            callback(null, StatusCodes.Good);
                        }
                    },
                    true
                );
                const sourceTime = coerceClock(self.$dataValue.sourceTimestamp, self.$dataValue.sourcePicoseconds);
                _setExtensionObject(self, extensionObject_, sourceTime);
            } else {
                errorLog(self.toString());
                errorLog("Unsupported case ! valueRank= ", self.valueRank);
            }
        } else {
            // verify that variant has the correct type
            assert(s.value.dataType === DataType.ExtensionObject);
            self.$extensionObject = s.value.value;
            assert(self.checkExtensionObjectIsCorrect(self.$extensionObject!));
            assert(s.statusCode.equals(StatusCodes.Good));
        }
        _installExtensionObjectBindingOnProperties(self, options!);
    }
}

const getIndexAsText = (index: number | number[]): string => {
    if (typeof index === "number")
        return `${index}`;
    return `${index.map((a) => a.toString()).join(",")}`;
}
const composeBrowseNameAndNodeId = (uaVariable: UAVariable, indexes: number[]) => {
    const iAsText = getIndexAsText(indexes);
    const browseName = coerceQualifiedName(iAsText);
    let nodeId: NodeId | undefined;
    if (uaVariable.nodeId.identifierType === NodeIdType.STRING) {
        nodeId = new NodeId(NodeIdType.STRING, uaVariable.nodeId.value as string + `[${iAsText}]`, uaVariable.nodeId.namespace);
    }
    return { browseName, nodeId };
}

export function _bindExtensionObjectArray(
    uaVariable: UAVariableImpl,
    optionalExtensionObjectArray?: ExtensionObject[],
    options?: BindExtensionObjectOptions
): ExtensionObject[] {
    return _bindExtensionObjectMatrix(uaVariable, optionalExtensionObjectArray, options);
}
export function _bindExtensionObjectMatrix(
    uaVariable: UAVariableImpl,
    optionalExtensionObjectArray?: ExtensionObject[],
    options?: BindExtensionObjectOptions
): ExtensionObject[] {

    if (uaVariable.valueRank < 1) {
        throw new Error("Variable must be a MultiDimensional array");
    }
    const arrayDimensions = uaVariable.arrayDimensions || [];

    if (!isVariableContainingExtensionObject(uaVariable)) {
        return [];
    }
    if ((arrayDimensions.length === 0 || arrayDimensions.length === 1 && arrayDimensions[0] === 0) && optionalExtensionObjectArray) {
        arrayDimensions[0] = optionalExtensionObjectArray.length;
    }

    const totalLength = arrayDimensions.reduce((p, c) => p * c, 1);

    /** */
    const addressSpace = uaVariable.addressSpace;
    if (optionalExtensionObjectArray) {
        if (optionalExtensionObjectArray.length !== totalLength) {
            throw new Error(`optionalExtensionObjectArray must have the expected number of element matching ${arrayDimensions}`)
        }
    }
    if (!optionalExtensionObjectArray) {
        optionalExtensionObjectArray = [];
        for (let i = 0; i < totalLength; i++) {
            optionalExtensionObjectArray[i] = addressSpace.constructExtensionObject(uaVariable.dataType, {});;
        }
    }
    uaVariable.$$extensionObjectArray = optionalExtensionObjectArray;

    // uaVariable.$$getElementBrowseName = getElementBrowseNameByIndex;

    uaVariable.bindVariable({
        get: () => new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.ExtensionObject,
            value: uaVariable.$$extensionObjectArray
        })
    }, true);
    const namespace = uaVariable.namespace;
    const indexIterator = new IndexIterator(arrayDimensions);
    for (let i = 0; i < totalLength; i++) {

        const index = indexIterator.next();

        const { browseName, nodeId } = composeBrowseNameAndNodeId(uaVariable, index);

        const uaElement = namespace.addVariable({
            browseName,
            nodeId,
            componentOf: uaVariable,
            dataType: uaVariable.dataType,
            valueRank: -1,
            accessLevel: uaVariable.userAccessLevel
        });
        {
            const capturedIndex = i;
            uaElement.bindVariable({
                get: () => new Variant({
                    dataType: DataType.ExtensionObject,
                    arrayType: VariantArrayType.Scalar,
                    value: uaVariable.$$extensionObjectArray[capturedIndex]
                })
            })
        }
    }
    return uaVariable.$$extensionObjectArray;
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
    c1[name] += 1;
    return partialData;
}
