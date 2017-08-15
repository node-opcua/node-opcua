"use strict";

function capitalizeFirstLetter(str)  {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
}
exports.capitalizeFirstLetter = capitalizeFirstLetter;


var ACode = "A".charCodeAt(0);
var ZCode = "Z".charCodeAt(0);
function isUpperCaseChar(c) {
    var code = c.charCodeAt(0);
    return code >= ACode && code <= ZCode;
}

// HelloWorld => helloWorld
// XAxis      => xAxis
// EURange    => euRange
function lowerFirstLetter(str) {
    var result =  str.substr(0, 1).toLowerCase() + str.substr(1);
    if (result.length>3 && isUpperCaseChar(str[1]) && isUpperCaseChar(str[2])) {
        result =  str.substr(0, 2).toLowerCase() + str.substr(2);
    }
    return result;
}
exports.lowerFirstLetter = lowerFirstLetter;


