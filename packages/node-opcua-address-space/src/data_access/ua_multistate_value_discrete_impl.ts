/**
 * @module node-opcua-address-space.DataAccess
 */
import { assert } from "node-opcua-assert";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { coerceInt32, coerceInt64toInt32, coerceUInt64, coerceUInt64toInt32, Int32, Int64, isValidInt64, isValidUInt64 } from "node-opcua-basic-types";
import { coerceLocalizedText, LocalizedText, QualifiedNameLike } from "node-opcua-data-model";
import { DataValue, DataValueT } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { StatusCode } from "node-opcua-status-code";
import { NumericRange } from "node-opcua-numeric-range";
import { DTEnumValue } from "node-opcua-nodeset-ua";
import { BindVariableOptions, INamespace, UAVariable, UAProperty, ISessionContext } from "node-opcua-address-space-base";
import { VariableTypeIds } from "node-opcua-constants";
import { _getBasicDataType, _getBasicDataTypeFromDataTypeNodeId } from "../get_basic_datatype";

import { registerNodePromoter } from "../../source/loader/register_node_promoter";
import { coerceEnumValues } from "../../source/helpers/coerce_enum_value";
import { UAMultiStateValueDiscreteEx } from "../../source/interfaces/data_access/ua_multistate_value_discrete_ex";
import { AddMultiStateValueDiscreteOptions } from "../../source/address_space_ts";
import { ISetStateOptions } from "../../source/interfaces/i_set_state_options";
import { UAVariableImpl } from "../ua_variable_impl";

import { add_dataItem_stuff } from "./add_dataItem_stuff";

function convertToArray<T>(array: any): T[] {
    if (Array.isArray(array)) return array;
    const result: T[] = [];
    for (let i = 0; i < array.length; i++) {
        result[i] = array[i];
    }
    return result;
}
const getCoerceToInt32 = (dataType: DataType) => {
    switch (dataType) {
        case DataType.UInt64:
            return coerceUInt64toInt32;
        case DataType.Int64:
            return coerceInt64toInt32;
        default:
            return coerceInt32;
    }
};

function install_synchronization<T extends number | Int64 | Int64, DT extends DataType>(
    variable: UAMultiStateValueDiscreteEx<T, DT>
) {
    const _variable = variable as UAMultiStateValueDiscreteEx<T, DT>;
    _variable.on("value_changed", (dataValue: DataValue) => {
        const valueAsTextNode = variable.valueAsText || (_variable.getComponentByName("ValueAsText") as UAVariable);
        if (!valueAsTextNode) {
            return;
        }
        if (dataValue.value.arrayType === VariantArrayType.Array || dataValue.value.arrayType === VariantArrayType.Matrix) {
            //
            const coerce = getCoerceToInt32(_variable.getBasicDataType());

            const values: number[] = convertToArray<Int32>(dataValue.value.value).map((a) => coerceInt32(a));
            const variantArray: Variant[] = values.map((a) => _variable.findValueAsText(a));
            const localizedText = variantArray.map((a) => a.value);

            const valueAsText1 = new Variant({
                arrayType: dataValue.value.arrayType,
                dataType: DataType.LocalizedText,
                value: localizedText,
                dimensions: dataValue.value.dimensions
            });
            valueAsTextNode.setValueFromSource(valueAsText1);
        } else {
            const valueAsText1 = _variable.findValueAsText(dataValue.value.value);
            valueAsTextNode.setValueFromSource(valueAsText1);
        }
    });
    const dataValue = _variable.readValue();
    // detect value changes to update valueAsText  (initial state)
    _variable.emit("value_changed", dataValue);
}

export interface UAMultiStateValueDiscreteImpl<T, DT extends DataType> {
    enumValues: UAProperty<DTEnumValue[], DataType.ExtensionObject>;
    valueAsText: UAProperty<LocalizedText, DataType.LocalizedText>;

    readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValueT<T, DT>;

    readValueAsync(context: ISessionContext | null, callback?: any): any;
}
export class UAMultiStateValueDiscreteImpl<T, DT extends DataType>
    extends UAVariableImpl
    implements UAMultiStateValueDiscreteEx<T, DT>
{
    public setValue(value: string | number | Int64, options?: ISetStateOptions): void {
        if (typeof value === "string") {
            const enumValues = this.enumValues.readValue().value.value;
            const selected = enumValues.filter((a: any) => a.displayName.text === value)[0];
            if (selected) {
                this._setValue(selected.value);
            } else {
                throw new Error("cannot find enum string " + value + " in " + enumValues.toString());
            }
        } else {
            this._setValue(coerceUInt64(value), options);
        }
    }

    public getValueAsString(): any {
        const v = this.valueAsText.readValue().value.value;
        if (Array.isArray(v)) {
            return v.map((a) => a.text);
        }
        return v.text || "";
    }

    public getValueAsNumber(): any {
        return this.readValue().value.value;
    }

    public checkVariantCompatibility(value: Variant): StatusCode {
        if (this.enumValues) {
            if (!this._isValueInRange(coerceInt32(value.value))) {
                return StatusCodes.BadOutOfRange;
            }
        }
        return StatusCodes.Good;
    }

    public clone<T, DT extends DataType>(options1: any, optionalFilter: any, extraInfo: any): UAMultiStateValueDiscreteImpl<T, DT> {
        const variable1 = UAVariableImpl.prototype.clone.call(this, options1, optionalFilter, extraInfo);
        return promoteToMultiStateValueDiscrete(variable1);
    }

    /**
     * @private
     */
    public _isValueInRange(value: number): boolean {
        // MultiStateValueDiscreteType
        const enumValues = this.enumValues.readValue().value.value as DTEnumValue[];
        const e = enumValues.findIndex((x: DTEnumValue) => coerceInt64toInt32(x.value) === value);
        return !(e === -1);
    }
    /**
     *
     * @private
     */
    public _enumValueIndex(): Record<Int32, DTEnumValue> {
        // construct an index to quickly find a EnumValue from a value
        const enumValues: DTEnumValue[] = this.enumValues.readValue().value.value;
        const enumValueIndex: Record<Int32, DTEnumValue> = {};
        if (!enumValues || !enumValues.forEach) {
            return enumValueIndex;
        }
        enumValues.forEach((e: DTEnumValue) => {
            const index = coerceInt64toInt32(e.value);
            enumValueIndex[index] = e;
        });
        return enumValueIndex;
    }

    /**
     *
     * @private
     */
    public _setValue(value: Int64, options?: ISetStateOptions): void {
        const int32Value = coerceInt64toInt32(value);
        // check that value is in bound
        if (!this._isValueInRange(int32Value)) {
            throw new Error("UAMultiStateValueDiscrete#_setValue out of range " + value);
        }

        const dataType = this._getDataType();
        if (dataType === DataType.Int64 || dataType === DataType.UInt64) {
            this.setValueFromSource({ dataType, arrayType: VariantArrayType.Scalar, value });
        } else {
            this.setValueFromSource({ dataType, arrayType: VariantArrayType.Scalar, value: int32Value });
        }
    }

    /**
     *
     * @private
     */
    public findValueAsText(value?: number | Int64): Variant {
        const enumValueIndex = this._enumValueIndex();
        if (value === undefined) {
            throw new Error("Unexpected undefined value");
        }
        const valueAsInt32 = coerceInt64toInt32(value);

        let valueAsText1 = "Invalid";
        if (enumValueIndex[valueAsInt32] !== undefined) {
            valueAsText1 = enumValueIndex[valueAsInt32].displayName.text || `Invalid:${value}`;
        }
        const result = new Variant({
            dataType: DataType.LocalizedText,
            value: coerceLocalizedText(valueAsText1)
        });
        return result;
    }

    public _getDataType(): DataType {
        if (this.dataType.value === 26 /* Number */) {
            return DataType.UInt32;
        }
        const dataTypeStr = DataType[this.dataType.value as number] as string;
        return (DataType as any)[dataTypeStr] as DataType;
    }

    /**
     *
     * @private
     */
    public _post_initialize(): void {
        // MultiStateValueDiscrete Variables can have any numeric Data Type;
        // this includes signed and unsigned integers from 8 to 64 Bit length.

        // istanbul ignore next
        validateIsNumericDataType(this.dataType.value);

        // find the enum value type
        install_synchronization(this);
    }
}

export function promoteToMultiStateValueDiscrete<T, DT extends DataType>(node: UAVariable): UAMultiStateValueDiscreteImpl<T, DT> {
    if (node instanceof UAMultiStateValueDiscreteImpl) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UAMultiStateValueDiscreteImpl.prototype);
    assert(node instanceof UAMultiStateValueDiscreteImpl, "should now  be a State Machine");
    (node as UAMultiStateValueDiscreteImpl<T, DT>)._post_initialize();
    return node as UAMultiStateValueDiscreteImpl<T, DT>;
}

registerNodePromoter(VariableTypeIds.MultiStateValueDiscreteType, promoteToMultiStateValueDiscrete);

export function _addMultiStateValueDiscrete<T, DT extends DataType>(
    namespace: INamespace,
    options: AddMultiStateValueDiscreteOptions
): UAMultiStateValueDiscreteEx<T, DT> {
    assert(Object.prototype.hasOwnProperty.call(options, "enumValues"));
    assert(!Object.prototype.hasOwnProperty.call(options, "ValuePrecision"));

    const addressSpace = namespace.addressSpace;

    const multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType");
    if (!multiStateValueDiscreteType) {
        throw new Error("expecting MultiStateValueDiscreteType to be defined , check nodeset xml file");
    }

    // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

    // EnumValueType
    //   value: Int64, displayName: LocalizedText, Description: LocalizedText
    const enumValues = coerceEnumValues(options.enumValues);

    if (options.value === undefined && enumValues[0]) {
        options.value = enumValues[0].value; // Int64
    }
    // Only DataTypes that can be represented with EnumValues are allowed for Variables of MultiStateValueDiscreteType.
    // These are Integers up to 64 Bits (signed and unsigned).:

    const dataType: DataType = _getBasicDataTypeFromDataTypeNodeId(addressSpace, options.dataType || DataType.UInt32);

    let value: undefined | BindVariableOptions;
    if (
        typeof options.value === "number" ||
        isValidUInt64(options.value as number | number[]) ||
        isValidInt64(options.value as number | number[])
    ) {
        value = new Variant({
            dataType,
            value: options.value
        });
    } else {
        value = options.value as any;
    }

    const cloned_options = {
        ...options,
        dataType,
        typeDefinition: multiStateValueDiscreteType.nodeId,
        // valueRank:
        // note : OPCUA Spec 1.03 specifies -1:Scalar (part 8 page 8) but nodeset file specifies -2:Any
        value,
        // limitation:  although the Specs specify -2:any, we only support -1(Scalar)
        valueRank: -1 // -1 : Scalar
    };

    const variable = namespace.addVariable(cloned_options) as UAMultiStateValueDiscreteEx<T, DT>;

    add_dataItem_stuff(variable, options);

    namespace.addVariable({
        accessLevel: "CurrentRead",
        browseName: { name: "EnumValues", namespaceIndex: 0 },
        dataType: "EnumValueType",
        valueRank: 1,
        minimumSamplingInterval: 0,
        modellingRule: options.modellingRule ? "Mandatory" : undefined,
        propertyOf: variable,
        typeDefinition: "PropertyType",
        userAccessLevel: "CurrentRead",
        value: new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.ExtensionObject,
            value: enumValues
        })
    });

    namespace.addVariable({
        accessLevel: "CurrentRead",
        browseName: { name: "ValueAsText", namespaceIndex: 0 },
        dataType: DataType.LocalizedText,
        minimumSamplingInterval: 0,
        modellingRule: options.modellingRule ? "Mandatory" : undefined,
        propertyOf: variable,
        arrayDimensions: options.arrayDimensions,
        valueRank: options.valueRank,
        typeDefinition: "PropertyType",
        userAccessLevel: "CurrentRead"
        // value: valueAsText
    });

    // install additional helpers methods
    variable.install_extra_properties();

    promoteToMultiStateValueDiscrete(variable);

    assert(variable.enumValues.browseName.toString() === "EnumValues");
    assert(variable.valueAsText.browseName.toString() === "ValueAsText");
    return variable;
}

const validBasicNumericDataTypes = [
    DataType.UInt64,
    DataType.Int64,
    DataType.UInt32,
    DataType.Int32,
    DataType.UInt16,
    DataType.Int16,
    DataType.Byte,
    DataType.Byte,
    DataType.SByte,
    26 /*Number*/
];
export function validateIsNumericDataType(dataTypeValue: any): void {
    if (typeof dataTypeValue !== "number" || validBasicNumericDataTypes.indexOf(dataTypeValue) < 0) {
        throw new Error(`Invalid DataType in UAMultiStateValueDiscrete => ${dataTypeValue.toString()}`);
    }
}

/** @deprecated: use validateIsNumericDataType instead */
export const validateDataType = validateIsNumericDataType;
