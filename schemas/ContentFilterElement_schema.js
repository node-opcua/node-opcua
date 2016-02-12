"use strict";
require("requirish")._(module);
var FilterOperator = require("schemas/FilterOperator_enum").FilterOperator;

// see OPCUA 1.02 Part 4 : section 7.4 Content Filter Part
// The ContentFilter structure defines a collection of elements that define filtering criteria. Each
// element in the collection describes an operator and an array of operands to be used by the operator.
// The operators that can be used in a ContentFilter are described in Table 110. The filter is evaluated
// by evaluating the first entry in the element array starting with the first operand in the operand array.
// The operands of an element may contain References to sub-elements resulting in the evaluation
// continuing to the referenced elements in the element array. If an elem ent cannot be traced back to
// the starting element it is ignored. Extra operands for any operator shall result in an error.

// see OPCUA 1.02 Part 4 : section 7.4 Content Filter Part

var ContentFilterElement_Schema = {
    name: "ContentFilterElement",
    fields: [
        // Filter operator to be evaluated.
        { name: "filterOperator", fieldType: "FilterOperator" /*, dataType: "i=576"*/ },
        // Operands used by the selected operator. The number and use depend on the
        // operators defined in Table 110. This array needs at least one entry.
        // This extensible parameter type is the FilterOperand parameter type specified
        // in 7.4.4. It specifies the list of valid FilterOperand values.
        //
        // note : filter operand can be: (ref 7.4.4 FilterOperand parameters page 120)
        // Symbolic Id     Description
        // Element         Specifies an index into the array of elements. This type is used to build a logic tree of
        //                 sub-elements by linking the operand of one element to a sub-element.
        // Literal         Specifies a literal value.
        // Attribute       Specifies any Attribute of an Object or Variable Node using a Node in the type system and
        //                 relative path constructed from ReferenceTypes and BrowseNames.
        // SimpleAttribute Specifies any Attribute of an Object or Variable Node using a TypeDefinition and a relative
        //                 path constructed from BrowseNames.
        { name: "filterOperands", fieldType: "ExtensionObject", isArray: true }
    ]

};
exports.ContentFilterElement_Schema = ContentFilterElement_Schema;
