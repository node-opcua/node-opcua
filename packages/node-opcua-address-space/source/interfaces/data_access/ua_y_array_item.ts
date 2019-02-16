/**
 * @module node-opcua-address-space
 */
import { DataType } from "node-opcua-variant";
import { UAVariableT } from "../..";
import { UAVariable } from "../..";

export interface UAYArrayItem {
    euRange: UAVariableT<DataType.ExtensionObject>;
    instrumentRange: UAVariable;
    title: UAVariableT<DataType.LocalizedText>;
    axisScaleType: UAVariableT<DataType.Int32>;
    xAxisDefinition: UAVariableT<DataType.ExtensionObject>;

}
// tslint:disable:no-empty-interface
export interface UAYArrayItem extends UAVariable {

}
