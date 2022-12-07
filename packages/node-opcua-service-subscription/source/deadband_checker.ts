/**
 * @module node-opcua-service-subscription
 */
import { assert } from "node-opcua-assert";

import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

export enum DeadbandType {
    None = 0x00,
    Absolute = 0x01,
    Percent = 0x02,
    Invalid = 0x1000
}

export type NumberType = number | number[];

export interface PseudoRange {
    low: number;
    high: number;
}

/**
 * @returns true if the difference between value1 and value2 is greater than absoluteDeadband
 */
function _isOutsideDeadbandScalar(value1: NumberType, value2: NumberType, dataType: DataType, absoluteDeadband: number): boolean {
    let diff;
    if (dataType === DataType.UInt64 || dataType === DataType.Int64) {
        // istanbul ignore next
        if (!(value1 instanceof Array && value2 instanceof Array)) {
            throw new Error("Invalid");
        }
        const h1 = value1[0]; // high
        const h2 = value2[0];
        if (h1 !== h2) {
            diff = (h1 - h2) * 4294967295;
            if (Math.abs(diff) > absoluteDeadband) {
                return true;
            }
        }
        diff = value1[1] - value2[1];
        assert(typeof diff === "number" && isFinite(diff));
        return Math.abs(diff) > absoluteDeadband;
    }
    // istanbul ignore next
    if (!(typeof value1 === "number" && typeof value2 === "number")) {
        throw new Error(
            "Invalid value in _isOutsideDeadbandScalar > expecting number only but got " + typeof value1 + " " + typeof value2
        );
    }
    diff = value2 - value1;
    assert(typeof diff === "number" && isFinite(diff));
    return Math.abs(diff) > absoluteDeadband;
}
function isOutsideDeadbandVariant(v1: Variant, v2: Variant, absoluteDeadBand: number): boolean {
    assert(isFinite(absoluteDeadBand));

    if (v1.arrayType === VariantArrayType.Array || v1.arrayType === VariantArrayType.Matrix) {
        // If the Value of the MonitoredItem is an array, then the deadband calculation logic shall be applied to
        // each element of the array. If an element that requires a DataChange is found, then no further
        // deadband checking is necessary and the entire array shall be returned.
        if (v1.dataType !== v2.dataType) {
            return true;
        }
        if (v1.value.length !== v2.value.length) {
            return true;
        }

        const n = v1.value.length;
        let i = 0;
        for (i = 0; i < n; i++) {
            if (_isOutsideDeadbandScalar(v1.value[i], v2.value[i], v1.dataType, absoluteDeadBand)) {
                return true;
            }
        }
        return false;
    } else {
        assert(v1.arrayType === VariantArrayType.Scalar);
        if (v1.dataType !== v2.dataType) {
            return true;
        }
        return _isOutsideDeadbandScalar(v1.value, v2.value, v1.dataType, absoluteDeadBand);
    }
}
// function isOnEdgeOfRangeScalar(
//     currentValue: NumberType,
//     newValue: NumberType,
//     dataType: DataType,
//     range: PseudoRange,
//     deadbandValue: number
// ): boolean {
//     if (dataType === DataType.UInt64 || dataType === DataType.Int64) {
//         // istanbul ignore next
//         if (!(currentValue instanceof Array && newValue instanceof Array)) {
//             throw new Error("Invalid");
//         }
//         currentValue = currentValue[1];
//         newValue = newValue[1];
//     }
//     if (Array.isArray(newValue)) throw new Error("internal error");
//     if (/*currentValue !== range.low && */ Math.abs(newValue - range.low) < deadbandValue) {
//         return true;
//     }
//     if (/*currentValue !== range.high && */ Math.abs(newValue - range.high) < deadbandValue) {
//         return true;
//     }
//     return false;
// }

// function isOnEdgeOfRange(currentValue: Variant, newValue: Variant, range: PseudoRange, deadbandValue: number): boolean {
//     if (currentValue.arrayType === VariantArrayType.Array) {
//         const n = currentValue.value.length;
//         let i = 0;
//         for (i = 0; i < n; i++) {
//             if (isOnEdgeOfRangeScalar(currentValue.value[i], newValue.value[i], newValue.dataType, range, deadbandValue)) {
//                 return true;
//             }
//         }
//         return false;
//     } else {
//         assert(currentValue.arrayType === VariantArrayType.Scalar);
//         assert(currentValue.dataType === newValue.dataType);
//         return isOnEdgeOfRangeScalar(currentValue.value, newValue.value, currentValue.dataType, range, deadbandValue);
//     }
// }

/**
 * @method isOutsideDeadbandNone
 * @return true if the element is in deadBand
 */
export function isOutsideDeadbandNone(variant1: Variant, variant2: Variant): boolean {
    // No Deadband calculation should be applied.
    return variant1.value !== variant2.value;
}
/**
 * @method isOutsideDeadbandAbsolute
 * @return true if the element is in deadBand
 */
export function isOutsideDeadbandAbsolute(variant1: Variant, variant2: Variant, deadbandValue: number): boolean {
    // No Deadband calculation should be applied.
    return isOutsideDeadbandVariant(variant1, variant2, deadbandValue);
}

/**
 * @method isOutsideDeadband
 * @return true if the element is outside deadBand
 */
export function isOutsideDeadbandPercent(variant1: Variant, variant2: Variant, deadbandValuePercent: number, range: PseudoRange): boolean {
    // DeadbandType = PercentDeadband
    // For this type of deadband the deadbandValue is defined as the percentage of the EURange. That is,
    // it applies only to AnalogItems with an EURange Property that defines the typical value range for the
    // item. This range shall be multiplied with the deadbandValue and then compared to the actual value change
    // to determine the need for a data change notification. The following pseudo code shows how the deadband
    // is calculated:
    //      DataChange if (absolute value of (last cached value - current value) >
    //                                          (deadbandValue/100.0) * ((high-low) of EURange)))
    //

    // The range of the deadbandValue is from 0.0 to 100.0 Percent.
    assert(deadbandValuePercent >= 0 && deadbandValuePercent <= 100);

    const valueRange = Math.abs(range.high - range.low);
    const deadBandValueAbsolute = (deadbandValuePercent / 100.0) * valueRange;

    // if (isOnEdgeOfRange(variant1, variant2, range, deadBandValueAbsolute)) {
    //     return true;
    // }

    return isOutsideDeadbandAbsolute(variant1, variant2, deadBandValueAbsolute);
}
