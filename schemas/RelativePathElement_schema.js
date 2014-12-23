
var RelativePathElement_Schema = {
    name: "RelativePathElement",
    documentation: "An element in a relative path.",
    fields: [
        { name: "referenceTypeId", fieldType: "NodeId", documentation: "The type of reference to follow." },
        { name: "isInverse", fieldType: "Boolean", documentation: "If TRUE the reverse reference is followed." },
        { name: "includeSubtypes", fieldType: "Boolean", documentation: "If TRUE then subtypes of the reference type are followed." },
        { name: "targetName", fieldType: "QualifiedName", documentation: "The browse name of the target." }
    ]
};
exports.RelativePathElement_Schema = RelativePathElement_Schema;