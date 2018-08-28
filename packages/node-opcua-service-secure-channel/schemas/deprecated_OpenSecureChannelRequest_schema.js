"use strict";

require("./RequestHeader_schema");
require("./ResponseHeader_schema");


const MessageSecurityMode =  require("./MessageSecurityMode_enum").MessageSecurityMode;
const SecurityTokenRequestType = require("./SecurityTokenRequestType_enum").SecurityTokenRequestType;


exports.OpenSecureChannelRequest_Schema =OpenSecureChannelRequest_Schema_as_per_XMLSCHEMA;
