"use strict";
const should = require("should");
const SymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").SymmetricAlgorithmSecurityHeader;

const SecureMessageChunkManager = require("..").SecureMessageChunkManager;
const SequenceNumberGenerator = require("..").SequenceNumberGenerator;

const makeMessageChunkSignatureForTest = require("../dist/test_helpers").makeMessageChunkSignatureForTest;
const verifyMessageChunkSignatureForTest = require("../dist/test_helpers").verifyMessageChunkSignatureForTest;
const performMessageChunkManagerTest = require("../dist/test_helpers").performMessageChunkManagerTest;




describe("MessageChunkManager", function() {


    it("should split a message in chunk and produce a header ( NO SIGN & NO ENCRYPT).", function() {

        performMessageChunkManagerTest({ signatureLength: 0 });

    });

    it("should split a message in chunk and produce a header (  SIGN & NO ENCRYPT).", function() {


        performMessageChunkManagerTest({
            signatureLength: 128,
            signBufferFunc: makeMessageChunkSignatureForTest,
            verifyBufferFunc: verifyMessageChunkSignatureForTest,
        });

    });


});

