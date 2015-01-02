
// see  OPCUA 1.02 Part 4 : section 7.4.4.2 ElementOperand page  120
// The ElementOperand provides the linking to sub-elements within a ContentFilter. The link is in the
// form of an integer that is used to index into the array of elements contained in the ContentFilter. An
// index is considered valid if its value is greater than the element index it is part of and it does not
// Reference a non-existent element. Clients shall construct filters in this way to avoid circular and
// invalid References. Servers should protect against invalid indexes by verifying the index prior to
// using it.
var ElementOperand_Schema = {
    name:"ElementOperand",
    baseType:"FilterOperand",
    fields: [
        {name: "index", fieldType:"UInt32", documentation:"Index into the element array"}
    ]
};
exports.ElementOperand_Schema = ElementOperand_Schema;
