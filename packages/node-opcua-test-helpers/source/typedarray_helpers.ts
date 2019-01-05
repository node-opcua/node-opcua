import * as should from "should";
const _should: any = should;

function __isEqual(a: any, b: any): boolean {
    if (!a && !b) {
        return true;
    }
    return a.toString() === b.toString();
}

function _is_equal(arr1: any[], arr2: any[]) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    let i;
    const n = arr1.length;
    for (i = 0; i < n; i++) {
        if (!__isEqual(arr1[i], arr2[i])) {
            // tslint:disable-next-line:no-console
            console.log("arr1 = ", arr1[i].toString());
            // tslint:disable-next-line:no-console
            console.log("arr2 = ", arr2[i].toString());
            return false;
        }
    }
    return true;
}

function dump_array(arr: any[]) {
    const a = [];
    let i;
    const n = arr.length;
    for (i = 0; i < n; i++) {
        a.push(arr[i]);
    }
    return "[ " + a.join(",") + "]";
}

export function assert_arrays_are_equal(arr1: any[], arr2: any[]) {
    if (arr1.constructor.name !== arr2.constructor.name) {
        throw new Error(" array do not have the same type " + arr1.constructor.name + " " + arr2.constructor.name);
    }
    if (!_is_equal(arr1, arr2)) {
        // tslint:disable-next-line:no-console
        console.log("arr1 = ", dump_array(arr1));
        // tslint:disable-next-line:no-console
        console.log("arr2 = ", dump_array(arr2));
    }
    _is_equal(arr1, arr2).should.eql(true);
}
