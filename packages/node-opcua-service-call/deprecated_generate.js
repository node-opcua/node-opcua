const generator = require("node-opcua-generator");
require("node-opcua-basic-types");
require("node-opcua-variant");

generator.registerObject("Argument");
// Call service
generator.registerObject("CallMethodRequest");
generator.registerObject("CallMethodResult");
generator.registerObject("CallRequest");
generator.registerObject("CallResponse");



