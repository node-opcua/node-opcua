import type { UInt32 } from "node-opcua-basic-types";
import type { NodeClass } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";
import type { BaseNode } from "./base_node";
import type { BindVariableOptions } from "./bind_variable";
import type { InstantiateOptions } from "./instantiate_options";
import type { UAMethod } from "./ua_method";
import type { UAObject } from "./ua_object";
import type { UAObjectType } from "./ua_object_type";
import type { UAVariable, VariableAttributes } from "./ua_variable";
import type { UAVariableT } from "./ua_variable_t";

export interface InstantiateVariableOptions extends InstantiateOptions {
    arrayDimensions?: number[] | null;
    dataType?: string | NodeIdLike;
    extensionObject?: ExtensionObject | ExtensionObject[];
    nodeId?: NodeIdLike;
    minimumSamplingInterval?: number;
    propertyOf?: NodeIdLike | UAObject | UAObjectType | UAVariable | UAVariableType | UAMethod;
    value?: BindVariableOptions;
    /**
     * This attribute indicates whether the Value attribute of the Variableis an array and how many dimensions the array has.
     * It may have the following values:
     *   * n > 1: the Value is an array with the specified number of dimensions.
     *   * OneDimension (1): The value is an array with one dimension.
     *   * OneOrMoreDimensions (0): The value is an array with one or more dimensions.
     *   * Scalar (−1): The value is not an array.
     *   * Any (−2): The value can be a scalar or an array with any number of dimensions.
     *   * ScalarOrOneDimension (−3): The value can be a scalar or a one dimensional array.
     *   * All DataTypes are considered to be scalar, even if they have array-like semantics like ByteString and String.
     *
     *
     * Note: the valueRank of the instantiated variable must be compatible with the valueRank of the VariableType.
     */
    valueRank?: number;
}
export interface UAVariableType extends BaseNode, VariableAttributes {
    readonly nodeClass: NodeClass.VariableType;
    readonly subtypeOfObj: UAVariableType | null;
    readonly subtypeOf: NodeId | null;

    dataType: NodeId;
    valueRank: number;
    minimumSamplingInterval: number;
    arrayDimensions: UInt32[] | null;
    historizing: boolean;

    isAbstract: boolean;

    isSubtypeOf(type: UAVariableType | NodeIdLike): boolean;

    /** @deprecated - use isSubtypeOf instead */
    isSupertypeOf(type: UAVariableType | NodeIdLike): boolean;

    instantiate(options: InstantiateVariableOptions): UAVariable;
    getBasicDataType(): DataType;
}

export interface UAVariableTypeT<T, DT extends DataType> extends UAVariableType {
    instantiate(options: InstantiateVariableOptions): UAVariableT<T, DT>;
}
