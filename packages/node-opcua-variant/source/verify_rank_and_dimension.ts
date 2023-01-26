import assert from "node-opcua-assert";

/**
 * ValueRank indicates whether the Value Attribute of the Variable can be an Array and how many dimensions
 *  * n > 1                     : the Value is an array with the specified number of dimensions.
 *  * OneDimension (1):           The value is an array with one dimension.
 *  * OneOrMoreDimensions (0):    The value is an array with one or more dimensions.
 *  * Scalar (-1):                The value is not an array.
 *  * Any (-2):                   The value can be a scalar or an array with any number of dimensions.
 *  * ScalarOrOneDimension (-3):  The value can be a scalar or a one dimensional array.
 */

export function verifyRankAndDimensions(options: { valueRank?: number; arrayDimensions?: number[] | null }): void {
    options.arrayDimensions = options.arrayDimensions || null;
    assert(options.arrayDimensions === null || Array.isArray(options.arrayDimensions));

    // evaluate valueRank arrayDimensions is specified but valueRank is null
    if (options.arrayDimensions && options.valueRank === undefined) {
        options.valueRank = options.arrayDimensions.length || -1;
    }
    options.valueRank = options.valueRank === undefined ? -1 : options.valueRank || 0; // UInt32
    assert(typeof options.valueRank === "number");

    if (options.arrayDimensions && options.valueRank <= 0) {
        if (options.arrayDimensions.length > 0) {
            throw new Error("[CONFORMANCE] arrayDimensions must be null if valueRank <=0");
        }
        options.arrayDimensions = null;
    }
    // specify default arrayDimension if not provided
    if (options.valueRank > 0 && (!options.arrayDimensions || options.arrayDimensions.length === 0)) {
        options.arrayDimensions = new Array(options.valueRank).fill(0);
    }
    // istanbul ignore next
    if (!options.arrayDimensions && options.valueRank > 0) {
        throw new Error("[CONFORMANCE] arrayDimension must be specified  if valueRank >0 " + options.valueRank);
    }
    if (options.valueRank > 0 && options.arrayDimensions!.length !== options.valueRank) {
        throw new Error(
            "[CONFORMANCE] when valueRank> 0, arrayDimensions must have valueRank elements, this.valueRank =" +
                options.valueRank +
                "  whereas arrayDimensions.length =" +
                options.arrayDimensions!.length
        );
    }
}
