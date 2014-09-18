
var should = require("should");

var SecurityPolicy = require("../../lib/misc/security_policy").SecurityPolicy;


describe("Security Policy",function(){

    it("should convert a security policy uri to an enum value",function() {

        var enumValue = SecurityPolicy.fromURI("http://opcfoundation.org/UA/SecurityPolicy#None");
        enumValue.should.equal(SecurityPolicy.None);

        enumValue = SecurityPolicy.fromURI("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
        enumValue.should.equal(SecurityPolicy.Basic256Rsa15);
    });
});