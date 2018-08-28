const generator = require("node-opcua-generator");

const getBuildInType = require("node-opcua-extension-object").ExtensionObject;
const ExtensionObject = require("node-opcua-extension-object").ExtensionObject;


generator.registerObject("AsymmetricAlgorithmSecurityHeader");
generator.registerObject("SymmetricAlgorithmSecurityHeader");
generator.registerObject("SequenceHeader");
generator.registerObject("ErrorMessage");


//xx generator.registerObject("DiagnosticInfo");
generator.registerObject("RequestHeader");
generator.registerObject("ResponseHeader");

generator.registerObject("ChannelSecurityToken");
generator.registerObject("SignatureData");

generator.registerObject("OpenSecureChannelRequest");
generator.registerObject("OpenSecureChannelResponse");
generator.registerObject("CloseSecureChannelRequest");
generator.registerObject("CloseSecureChannelResponse");
generator.registerObject("ServiceFault");
