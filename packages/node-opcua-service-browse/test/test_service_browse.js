"use strict";
const should  =require("should");
const browse_service = require("..");
const redirectToFile = require("node-opcua-debug").redirectToFile;

const BrowseDirection = require("node-opcua-data-model").BrowseDirection;

describe("Testing Browse Service",function() {

    it("should create a BrowseRequest",function() {

        const browseRequest = new browse_service.BrowseRequest({});

    });
    it("should create a BrowseResponse",function() {

        const browseResponse = new browse_service.BrowseResponse({});

    });

});

describe("Browse Service", function () {

    const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

    it("should construct a BrowseDescription", function () {

        const makeNodeId = require("node-opcua-nodeid").makeNodeId;

        const browseDescription = new browse_service.BrowseDescription({
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

    it("should create a BrowseRequest", function () {
        const browseRequest = new browse_service.BrowseRequest({
            view: {},
            requestedMaxReferencesPerNode: 1,
            nodesToBrowse: [{}]
        });
        encode_decode_round_trip_test(browseRequest);
    });

    it("should create a BrowseRequest with correct default value in  viewDescription", function () {
        const browseRequest = new browse_service.BrowseRequest({
            view: {},
            requestedMaxReferencesPerNode: 1,
            nodesToBrowse: [{}]
        });
        // by default timeStamp shall be set to minDate
        browseRequest.view.viewId.toString().should.eql("ns=0;i=0");
        browseRequest.view.viewVersion.should.eql(0);

        // timestamp shall be minDate( 01/01/1601) to satisfy the .NET server
        // implementation.
        const date_time = require("node-opcua-date-time");
        date_time.bn_dateToHundredNanoSecondFrom1601(browseRequest.view.timestamp).should.eql([0, 0]);
    });


    it("should create a BrowseResponse", function () {
        const browseResponse = new browse_service.BrowseResponse({});
        encode_decode_round_trip_test(browseResponse);
    });

    it("should jsonify a ReferenceDescription", function () {

        redirectToFile('ReferenceDescription_to_json.log', function () {

            const StatusCodes = require("node-opcua-status-code").StatusCodes;
            const makeNodeId = require("node-opcua-nodeid").makeNodeId;
            const NodeClass = require("node-opcua-data-model").NodeClass;


            const ref = new browse_service.ReferenceDescription({
                referenceTypeId: "ns=1;i=10",
                isForward: true,
                nodeClass: NodeClass.Variable,
                browseName: {name: "toto"}
            });


            const json_str = JSON.stringify(ref, null, " ");
            const b = new browse_service.ReferenceDescription(JSON.parse(json_str));

            console.log(require("util").inspect(ref, {colors: true, depth: 15}));
            console.log("/////");
            console.log(json_str);
            console.log(" --------> ");
            console.log(require("util").inspect(b, {colors: true, depth: 15}));

            b.should.eql(ref);
        });

    });

    it("should jsonify a BrowseResponse", function () {


        redirectToFile('BrowseResponse_to_json.log', function () {

            const StatusCodes = require("node-opcua-status-code").StatusCodes;
            const makeNodeId = require("node-opcua-nodeid").makeNodeId;
            const NodeClass = require("node-opcua-data-model").NodeClass;

            const ref = new browse_service.ReferenceDescription({
                referenceTypeId: "ns=1;i=10",
                isForward: true,
                nodeClass: NodeClass.Variable,
                browseName: {name: "toto"}
            });

            const browseResponse = new browse_service.BrowseResponse({
                results: [{
                    statusCode: StatusCodes.Good,
                    references: [ref]
                }
                ]
            });
            const object = browseResponse;

            const json_str = JSON.stringify(object, null, " ");

            console.log(require("util").inspect(object, {colors: true, depth: 15}));
            console.log("/////".yellow.bold);
            console.log(json_str);

            const b = new browse_service.BrowseResponse(JSON.parse(json_str));

            console.log(" --------> ");
            console.log(require("util").inspect(b, {colors: true, depth: 15}));

            b.should.eql(object);

        });

    });





});