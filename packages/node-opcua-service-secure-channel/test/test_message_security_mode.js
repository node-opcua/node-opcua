require("should");
const coerceMessageSecurityMode = require("..").coerceMessageSecurityMode;
const MessageSecurityMode = require("..").MessageSecurityMode;


describe("MessageSecurityMode",function() {

    it("should coerce a string into MessageSecurityMode",function() {

        coerceMessageSecurityMode("None").should.eql(MessageSecurityMode.None);
        coerceMessageSecurityMode("NONE").should.eql(MessageSecurityMode.Invalid);
        coerceMessageSecurityMode("Sign").should.eql(MessageSecurityMode.Sign);

        coerceMessageSecurityMode(2).should.eql(MessageSecurityMode.Sign);
        coerceMessageSecurityMode(3).should.eql(MessageSecurityMode.SignAndEncrypt);

    });

});