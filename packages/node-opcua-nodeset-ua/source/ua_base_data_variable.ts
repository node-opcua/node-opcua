import type { UAVariableT } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

// biome-ignore lint/suspicious/noEmptyInterface: forward-compatible placeholder for OPC-UA generated types
export interface UABaseDataVariable_Base<T, DT extends DataType>  {}
export interface UABaseDataVariable<T, DT extends DataType> extends UAVariableT<T, DT>, UABaseDataVariable_Base<T, DT> {}