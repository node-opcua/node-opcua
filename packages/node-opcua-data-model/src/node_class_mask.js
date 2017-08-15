var Enum = require("node-opcua-enum");

// Specifies the NodeClasses of the TargetNodes. Only TargetNodes with the
// selected NodeClasses are returned. The NodeClasses are assigned the
// following bits:
// If set to zero, then all NodeClasses are returned.
// @example
//    var mask = NodeClassMask.get("Object |  ObjectType");
//    mask.value.should.eql(1 + (1<<3));

var NodeClassMask = new Enum({
    "Object": (1 << 0),
    "Variable": (1 << 1),
    "Method": (1 << 2),
    "ObjectType": (1 << 3),
    "VariableType": (1 << 4),
    "ReferenceType": (1 << 5),
    "DataType": (1 << 6),
    "View": (1 << 7)
});
exports.NodeClassMask = NodeClassMask;
// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
exports.makeNodeClassMask = function (str) {
    var classMask = NodeClassMask.get(str);
    /* istanbul ignore next */
    if (!classMask) {
        throw new Error(" cannot find class mask for " + str);
    }
    return classMask.value;
};
