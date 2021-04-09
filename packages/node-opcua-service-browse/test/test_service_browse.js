"use strict";
const should = require("should");

const { redirectToFile } = require("node-opcua-debug/nodeJS");
const { makeNodeId  } = require("node-opcua-nodeid");
const { BrowseDirection }= require("node-opcua-data-model");
const {  StatusCodes }= require("node-opcua-status-code");
const { NodeClass }  = require("node-opcua-data-model");
const {bn_dateToHundredNanoSecondFrom1601} = require("node-opcua-date-time");

const chalk = require("chalk");

const { 
    BrowseRequest,
    BrowseResponse,
    ReferenceDescription,
    BrowseDescription
} = require("..");

const { checkDebugFlag, make_debugLog } = require("node-opcua-debug");

const doDebug = checkDebugFlag("TEST");
const debugLog = make_debugLog("TEST");

describe("Testing Browse Service", function() {

    it("should create a BrowseRequest", function() {
        const browseRequest = new BrowseRequest({});
        browseRequest.should.have.property("requestHeader");
    });
    it("should create a BrowseResponse", function() {
        const browseResponse = new BrowseResponse({});
        browseResponse.should.have.property("responseHeader");
        if (doDebug) {
            debugLog(browseResponse.toString());
        }
    });

});

describe("Browse Service", function() {

    const { encode_decode_round_trip_test  } = require("node-opcua-packet-analyzer/dist/test_helpers");

    it("should construct a BrowseDescription", function() {
        const browseDescription = new BrowseDescription({
            browseDirection: BrowseDirection.Both,
            referenceTypeId: makeNodeId(12),
            includeSubtypes: true,
            nodeClassMask: 25,
            resultMask: 32
        });
        browseDescription.browseDirection.should.eql(BrowseDirection.Both);
        browseDescription.referenceTypeId.value.should.eql(12);
        browseDescription.includeSubtypes.should.equal(true);
        encode_decode_round_trip_test(browseDescription);
    });

    it("should create a BrowseRequest", function() {
        const browseRequest = new BrowseRequest({
            view: {},
            requestedMaxReferencesPerNode: 1,
            nodesToBrowse: [{}]
        });
        encode_decode_round_trip_test(browseRequest);
    });

    it("should create a BrowseRequest with correct default value in  viewDescription", function() {
        const browseRequest = new BrowseRequest({
            view: {},
            requestedMaxReferencesPerNode: 1,
            nodesToBrowse: [{}]
        });
        // by default timeStamp shall be set to minDate
        browseRequest.view.viewId.toString().should.eql("ns=0;i=0");
        browseRequest.view.viewVersion.should.eql(0);

        // timestamp shall be minDate( 01/01/1601) to satisfy the .NET server
        // implementation.
        bn_dateToHundredNanoSecondFrom1601(browseRequest.view.timestamp).should.eql([0, 0]);
    });

    it("should create a BrowseResponse", function() {
        const browseResponse = new BrowseResponse({});
        encode_decode_round_trip_test(browseResponse);
    });

    it("should jsonify a ReferenceDescription", function() {

        redirectToFile('ReferenceDescription_to_json.log', function() {

            const ref = new ReferenceDescription({
                referenceTypeId: "ns=1;i=10",
                isForward: true,
                nodeClass: NodeClass.Variable,
                browseName: { name: "toto" }
            });

            const json_str = JSON.stringify(ref, null, " ");
            const b = new ReferenceDescription(JSON.parse(json_str));

            console.log(require("util").inspect(ref, { colors: true, depth: 15 }));
            console.log("/////");
            console.log(json_str);
            console.log(" --------> ");
            console.log(require("util").inspect(b, { colors: true, depth: 15 }));

            b.should.eql(ref);
        });
    });

    it("should jsonify a BrowseResponse", function() {

        redirectToFile('BrowseResponse_to_json.log', function() {

            const ref = new ReferenceDescription({
                referenceTypeId: "ns=1;i=10",
                isForward: true,
                nodeClass: NodeClass.Variable,
                browseName: { name: "toto" }
            });

            const browseResponse = new BrowseResponse({
                results: [{
                    statusCode: StatusCodes.Good,
                    references: [ref]
                }
                ]
            });

            // trick here : replace date to ease comparaison
            browseResponse.responseHeader.timestamp = new Date();

            const object = browseResponse;

            const json_str = JSON.stringify(object, null, " ");

            console.log("--------------------------------------");
            console.log(require("util").inspect(object, { colors: true, depth: 15 }));
            console.log(chalk.yellow.bold("/////"));
            console.log(json_str);

            const b = new BrowseResponse(JSON.parse(json_str));

            console.log(" --------> ");
            console.log(require("util").inspect(b, { colors: true, depth: 15 }));

            b.should.eql(object);
        });
    });
});