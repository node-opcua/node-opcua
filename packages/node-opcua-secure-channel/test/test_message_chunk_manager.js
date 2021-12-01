"use strict";
const should = require("should");

const {
    makeMessageChunkSignatureForTest,
    verifyMessageChunkSignatureForTest,
    performMessageChunkManagerTest
} = require("../dist/test_helpers");

describe("MessageChunkManager", function () {
    it("should split a message in chunk and produce a header ( NO SIGN & NO ENCRYPT).", function () {
        performMessageChunkManagerTest({ signatureLength: 0 });
    });

    it("should split a message in chunk and produce a header (  SIGN & NO ENCRYPT).", function () {
        performMessageChunkManagerTest({
            signatureLength: 128,
            signBufferFunc: makeMessageChunkSignatureForTest,
            verifyBufferFunc: verifyMessageChunkSignatureForTest
        });
    });
});
