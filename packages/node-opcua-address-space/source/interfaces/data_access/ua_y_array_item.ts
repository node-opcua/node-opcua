/**
 * @module node-opcua-address-space
 */
import { Int32 } from "node-opcua-basic-types";
import { AxisInformation } from "node-opcua-data-access";
import { LocalizedText } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { Range } from "node-opcua-types";

import { UAVariableT } from "../..";
import { UAVariable } from "../..";
export interface UAYArrayItem {
    euRange: UAVariableT<Range, DataType.ExtensionObject>;
    instrumentRange: UAVariable;
    title: UAVariableT<LocalizedText, DataType.LocalizedText>;
    axisScaleType: UAVariableT<Int32, DataType.Int32>;
    xAxisDefinition: UAVariableT<AxisInformation, DataType.ExtensionObject>;

}
// tslint:disable:no-empty-interface
export interface UAYArrayItem extends UAVariable {

}
