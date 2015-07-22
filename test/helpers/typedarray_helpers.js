function _is_equal(arr1, arr2) {

    if (arr1.length !== arr2.length) {
        return false;
    }
    var i, n = arr1.length;
    for (i = 0; i < n; i++) {
        if (arr1[i] !== arr1[i]) {
            return false;
        }
    }
    return true;
}
function dump_array(arr) {
    var a = [];
    var i, n = arr.length;
    for (i = 0; i < n; i++) {
        a.push(arr[i]);
    }
    return '[ ' + a.join(",") + "]";
}
function assert_arrays_are_equal(arr1, arr2) {
    if (arr1.constructor.name !== arr2.constructor.name) {
        throw new Error(" array do not have the same type " + arr1.constructor.name + " " + arr2.constructor.name);
    }
    if (!_is_equal(arr1, arr2)) {
        console.log("arr1 = ", dump_array(arr1));
        console.log("arr2 = ", dump_array(arr2));
    }
    _is_equal(arr1, arr2).should.eql(true);
}

exports.assert_arrays_are_equal = assert_arrays_are_equal;
