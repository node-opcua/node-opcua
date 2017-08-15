var generator = require("node-opcua-generator");

require("node-opcua-data-model");
require("node-opcua-service-endpoints");

generator.registerObject("SignedSoftwareCertificate");



generator.registerObject("ActivateSessionRequest");
generator.registerObject("ActivateSessionResponse");

generator.registerObject("CreateSessionRequest");
generator.registerObject("CreateSessionResponse");

generator.registerObject("CloseSessionRequest");
generator.registerObject("CloseSessionResponse");

generator.registerObject("CancelRequest");
generator.registerObject("CancelResponse");


generator.registerObject("AnonymousIdentityToken");
generator.registerObject("UserNameIdentityToken");
generator.registerObject("X509IdentityToken");
generator.registerObject("IssuedIdentityToken");
