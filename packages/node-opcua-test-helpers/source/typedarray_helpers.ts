import "should";

/**
 * An array-like value: a regular Array or any TypedArray
 * (Uint8Array, Float64Array, Int32Array, etc.).
 */
type ArrayOrTypedArray = ArrayLike<unknown> & { readonly length: number };

function elementsAreEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    return String(a) === String(b);
}

function arraysAreEqual(arr1: ArrayOrTypedArray, arr2: ArrayOrTypedArray): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (!elementsAreEqual(arr1[i], arr2[i])) {
            return false;
        }
    }
    return true;
}

function formatArray(arr: ArrayOrTypedArray): string {
    const items: unknown[] = [];
    for (let i = 0; i < arr.length; i++) {
        items.push(arr[i]);
    }
    return `[${items.join(", ")}]`;
}

/**
 * Assert that two arrays (or TypedArrays) have the same type and
 * contain the same elements (compared via string coercion).
 *
 * On mismatch the actual and expected values are logged before
 * the assertion fails.
 */
export function assert_arrays_are_equal(arr1: ArrayOrTypedArray, arr2: ArrayOrTypedArray): void {
    if (arr1.constructor.name !== arr2.constructor.name) {
        throw new Error(`array type mismatch: ${arr1.constructor.name} vs ${arr2.constructor.name}`);
    }
    const equal = arraysAreEqual(arr1, arr2);
    if (!equal) {
        console.error("arr1 =", formatArray(arr1));
        console.error("arr2 =", formatArray(arr2));
    }
    equal.should.eql(true);
}
