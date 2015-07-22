"use strict";
require("requirish")._(module);
var Enum = require("lib/misc/enum").Enum;

var WriteMask = new Enum({
    AccessLevel: (1 << 0),// Indicates if the AccessLevel Attribute is writable.
    ArrayDimensions: (1 << 1),// Indicates if the ArrayDimensions Attribute is writable.
    BrowseName: (1 << 2), //Indicates if the BrowseName Attribute is writable.
    ContainsNoLoops: (1 << 3), //Indicates if the ContainsNoLoops Attribute is writable.
    DataType: (1 << 4), //Indicates if the DataType Attribute is writable.
    Description: (1 << 5), // Indicates if the Description Attribute is writable.
    DisplayName: (1 << 6), // Indicates if the DisplayName Attribute is writable.
    EventNotifier: (1 << 7), // Indicates if the EventNotifier Attribute is writable.
    Executable: (1 << 8), // Indicates if the Executable Attribute is writable.
    Historizing: (1 << 9), // Indicates if the Historizing Attribute is writable.
    InverseName: (1 << 10), // Indicates if the InverseName Attribute is writable.
    IsAbstract: (1 << 11), // Indicates if the IsAbstract Attribute is writable.
    MinimumSamplingInterval: (1 << 12), // Indicates if the MinimumSamplingInterval Attribute is writable.
    NodeClass: (1 << 13), // Indicates if the NodeClass Attribute is writable.
    NodeId: (1 << 14), // Indicates if the NodeId Attribute is writable.
    Symmetric: (1 << 15), // Indicates if the Symmetric Attribute is writable.
    UserAccessLevel: (1 << 16), // Indicates if the UserAccessLevel Attribute is writable.
    UserExecutable: (1 << 17), // Indicates if the UserExecutable Attribute is writable.
    UserWriteMask: (1 << 18), // Indicates if the UserWriteMask Attribute is writable.
    ValueRank: (1 << 19), // Indicates if the ValueRank Attribute is writable.
    WriteMask: (1 << 20), // Indicates if the WriteMask Attribute is writable.
    ValueForVariableType: (1 << 21)  // Indicates if the Value Attribute is writable for a VariableType. It does not apply for
                                     // Variables since this is handled by the AccessLevel and UserAccessLevel
                                     // Attributes for the Variable. For Variables this bit shall be set to 0.
    // Reserved 22:31 Reserved for future use. Shall always be zero.
});


