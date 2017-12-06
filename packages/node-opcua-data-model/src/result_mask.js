"use strict";
// Specifies the fields in the ReferenceDescription structure that should be
// returned. The fields are assigned the following bits:
var ResultMask = require("../schemas/ResultMask_enum").ResultMask;
exports.ResultMask = ResultMask;
// The ReferenceDescription type is defined in 7.24.
// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
exports.makeResultMask = function (str) {
    return ResultMask.get(str).value;
};


