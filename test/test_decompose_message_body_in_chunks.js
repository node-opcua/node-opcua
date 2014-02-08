var decompose_message_body_in_chunks = require("./../lib/secure_channel_service").decompose_message_body_in_chunks;
var should = require("should");

describe("decompose_message_body_in_chunks",function(){

    it("should decompose a message body in at least one chunk ",function(){
        var message_body = new Buffer("At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis");

        var chunks  = decompose_message_body_in_chunks(message_body,"MSG",128);
        chunks.length.should.be.greaterThan(0);

    });
});


