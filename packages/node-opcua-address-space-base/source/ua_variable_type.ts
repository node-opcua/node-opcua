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

    public isSupertypeOf(type:  UAVariableType | NodeIdLike): boolean;

    public instantiate(options: InstantiateVariableOptions): UAVariable;
}

export interface UAVariableTypeT<T, DT extends DataType> extends UAVariableType {
    instantiate(options: InstantiateVariableOptions): UAVariableT<T, DT>;
}
