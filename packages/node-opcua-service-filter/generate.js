var generator = require("node-opcua-generator");
var registerObject = generator.registerObject;

require("node-opcua-service-secure-channel");

registerObject("MonitoringFilter");
// ContentFilter
registerObject("FilterOperand");
registerObject("SimpleAttributeOperand");
registerObject("ElementOperand");
registerObject("LiteralOperand");
registerObject("AttributeOperand");

registerObject("ContentFilterElement");
registerObject("ContentFilter");

registerObject("EventFilter");
