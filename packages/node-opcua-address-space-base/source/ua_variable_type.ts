import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { UInt32 } from "node-opcua-basic-types";
import { DataType } from "node-opcua-variant";
import { ExtensionObject } from "node-opcua-extension-object";

import { BaseNode } from "./base_node";
import { InstantiateOptions } from "./instantiate_options";
import { UAObject } from "./ua_object";
import { UAObjectType } from "./ua_object_type";
import { UAVariable, VariableAttributes } from "./ua_variable";
import { UAVariableT } from "./ua_variable_t";
import { BindVariableOptions } from "./bind_variable";
import { UAMethod } from "./ua_method";

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
export declare class UAVariableType extends BaseNode implements VariableAttributes {
    public readonly nodeClass: NodeClass.VariableType;
    public readonly subtypeOfObj: UAVariableType | null;
    public readonly subtypeOf: NodeId | null;

    public dataType: NodeId;
    public valueRank: number;
    public minimumSamplingInterval: number;
    public arrayDimensions: UInt32[] | null;
    public historizing: boolean;

    public isAbstract: boolean;

    public isSubtypeOf(type: UAVariableType | NodeIdLike): boolean;

    /** @deprecated - use isSubtypeOf instead */
    public isSupertypeOf(type: UAVariableType | NodeIdLike): boolean;

    public instantiate(options: InstantiateVariableOptions): UAVariable;
    public getBasicDataType(): DataType;
}

export interface UAVariableTypeT<T, DT extends DataType> extends UAVariableType {
    instantiate(options: InstantiateVariableOptions): UAVariableT<T, DT>;
}
