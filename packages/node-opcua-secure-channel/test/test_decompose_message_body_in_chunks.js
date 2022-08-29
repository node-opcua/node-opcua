"use strict";

require("should");
const { decompose_message_body_in_chunks } = require("../dist/test_helpers");

describe("decompose message body in chunks", function () {
    it("should decompose a message body in at least one chunk ", function () {
        const message_body = Buffer.from("At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis");
        const chunks = decompose_message_body_in_chunks(message_body, "MSG", 128);
        chunks.length.should.be.greaterThan(0);
    });
});
