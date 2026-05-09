import type {
    AddVariableOptionsWithoutValue,
    AddYArrayItemOptions,
    BindVariableOptions,
    UADataType
} from "node-opcua-address-space-base";
import type { NodeIdLike } from "node-opcua-nodeid";
import type { UAAnalogItem, UADataItem } from "node-opcua-nodeset-ua";
import type { EUInformation, EUInformationOptions } from "node-opcua-types";
import type { DataType, VariantArrayType } from "node-opcua-variant";
import type {
    AddMultiStateDiscreteOptions,
    AddMultiStateValueDiscreteOptions,
    AddTwoStateDiscreteOptions,
    AddTwoStateVariableOptions
} from "./address_space_ts";
import type { UAMultiStateDiscreteEx } from "./interfaces/data_access/ua_multistate_discrete_ex";
import type { UAMultiStateValueDiscreteEx } from "./interfaces/data_access/ua_multistate_value_discrete_ex";
import type { UATwoStateDiscreteEx } from "./interfaces/data_access/ua_two_state_discrete_ex";
import type { UAYArrayItemEx } from "./interfaces/data_access/ua_y_array_item_ex";
import type { UATwoStateVariableEx } from "./ua_two_state_variable_ex";

export interface AddDataItemOptions extends AddVariableOptionsWithoutValue {
    arrayType?: VariantArrayType;
    value?: BindVariableOptions;

    /** @example  "(tempA -25) + tempB" */
    definition?: string;
    /** @example 0.5 */
    valuePrecision?: number;
}

export interface AddAnalogDataItemOptions extends AddDataItemOptions {
    value?: BindVariableOptions;

    engineeringUnitsRange?: {
        low: number;
        high: number;
    };
    instrumentRange?: {
        low: number;
        high: number;
    };
    engineeringUnits?: EUInformationOptions | EUInformation;
    minimumSamplingInterval?: number;
    dataType?: string | NodeIdLike | UADataType;

    /**
     * the acceptValueOutOfRange property indicates whether the write operation will accept or reject a value which
     * is out of range of the instrumentRange.
     *
     * **if true**: during a writeOperation by a client if the dataValue that is outside of the instrumentRange
     * it will be recorded database and the statusCode will be set to BadOutOfRange, and
     * the write operation will return Good. If the variable supports historizing, the value will be recorded in the history database.
     * as well.
     *
     * **if false**: during a writeOperation by a client, if the dataValue that is outside of the instrumentRange
     * it will be denied and the write operation will return BadOutOfRange.
     *
     * @default undefined (false)
     *
     */
    acceptValueOutOfRange?: boolean;
}

export interface UAAnalogItemEx<T, DT extends DataType> extends UAAnalogItem<T, DT> {
    acceptValueOutOfRange?: boolean;
}
export interface INamespaceDataAccess {
    addDataItem<T, DT extends DataType>(options: AddDataItemOptions): UADataItem<T, DT>;
    addAnalogDataItem<T, DT extends DataType>(options: AddAnalogDataItemOptions): UAAnalogItemEx<T, DT>;

    addYArrayItem<DT extends DataType.Double | DataType.Float>(options: AddYArrayItemOptions): UAYArrayItemEx<DT>;

    addTwoStateVariable(options: AddTwoStateVariableOptions): UATwoStateVariableEx;

    addTwoStateDiscrete(options: AddTwoStateDiscreteOptions): UATwoStateDiscreteEx;

    addMultiStateDiscrete<T, DT extends DataType>(options: AddMultiStateDiscreteOptions): UAMultiStateDiscreteEx<T, DT>;

    addMultiStateValueDiscrete<T, DT extends DataType>(
        options: AddMultiStateValueDiscreteOptions
    ): UAMultiStateValueDiscreteEx<T, DT>;
}
