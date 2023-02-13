


/**
 * This valueRank indicates whether the Value attribute of the Variable is an array and how many dimensions the array has.
 * It may have the following values:
 *   * n > 1: the Value is an array with the specified number of dimensions.
 *   * OneDimension (1): The value is an array with one dimension.
 *   * OneOrMoreDimensions (0): The value is an array with one or more dimensions.
 *   * Scalar (−1): The value is not an array.
 *   * Any (−2): The value can be a scalar or an array with any number of dimensions.
 *   * ScalarOrOneDimension (−3): The value can be a scalar or a one dimensional array.
 *   * All DataTypes are considered to be scalar, even if they have array-like semantics like ByteString and String.
 */

export function checkValueRankCompatibility(actualValueRank: number, baseTypeValueRank: number): { result: boolean, errorMessage?: string } {
    const ScalarOrOneDimension = -3;
    const OneOrMoreDimensions = 0;
    const AnyDimension = -2;
    const OneDimension = 1;
    const Scalar = -1;
    const t = (valueRank: number): string => {
        switch (valueRank) {
            case ScalarOrOneDimension: return `ScalarOrOneDimension(${valueRank})`;
            case OneOrMoreDimensions: return `OneOrMoreDimensions(${valueRank})`;
            case AnyDimension: return `AnyDimension(${valueRank})`;
            case OneDimension: return `OneDimension(${valueRank})`;
            case Scalar: return `Scalar(${valueRank})`;
        }
        if (valueRank < 0) {
            return `InvalidValueRank(${valueRank})`;
        }
        return "" + valueRank;
    }
    if (actualValueRank < 0) {
        if (actualValueRank !== Scalar && actualValueRank !== AnyDimension && actualValueRank !== ScalarOrOneDimension) {
            return {
                result: false,
                errorMessage: `Invalid valueRank: ${t(actualValueRank)}  can only be ${t(ScalarOrOneDimension)} ${t(AnyDimension)}, ${t(Scalar)} ${t(OneOrMoreDimensions)} or a positive number`
            };
        }
    }
    if (baseTypeValueRank === AnyDimension) {
        return { result: true };
    }
    if (baseTypeValueRank === OneDimension || baseTypeValueRank > 1) {
        if (actualValueRank === baseTypeValueRank) {
            return { result: true };
        };
        return {
            result: false,
            errorMessage: `Invalid valueRank: ${t(actualValueRank)}:  valueRank can only be identical to base type ${t(baseTypeValueRank)}`
        };
    }
    if (baseTypeValueRank === Scalar) {
        if (actualValueRank === Scalar) return { result: true };
        return {
            result: false,
            errorMessage: `Invalid valueRank: ${t(actualValueRank)}: valueRank can only be identical to base type ${t(Scalar)}`
        };
    }
    if (baseTypeValueRank === OneOrMoreDimensions) {
        if (actualValueRank === OneOrMoreDimensions || actualValueRank >= 1) return { result: true };
        return {
            result: false,
            errorMessage: `Invalid valueRank: ${t(actualValueRank)}: valueRank can only be identical to base type ${t(OneOrMoreDimensions)} or be a positive number`
        };
    }
    if (baseTypeValueRank === ScalarOrOneDimension) {
        if (actualValueRank === OneDimension || actualValueRank === Scalar || actualValueRank === ScalarOrOneDimension) return { result: true };
        return {
            result: false,
            errorMessage: `Invalid valueRank: ${t(actualValueRank)}: valueRank can only be identical to base type ${t(ScalarOrOneDimension)} , ${t(Scalar)} or ${t(OneDimension)}.`
        };
    }
    return { result: false };
}


