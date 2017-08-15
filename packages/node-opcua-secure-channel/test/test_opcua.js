"use strict";
var should = require("should");
var util = require("util");

var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var StatusCodes = require("node-opcua-status-code").StatusCodes;

var RequestHeader = require("../src/services").RequestHeader;
var ChannelSecurityToken =  require("../src/services").ChannelSecurityToken;
var ResponseHeader =  require("../src/services").ResponseHeader;

describe("testing OPCUA structures ", function () {


    it("should create a RequestHeader", function () {

        var requestHeader = new RequestHeader();

        requestHeader.should.have.property("authenticationToken");
        requestHeader.should.have.property("timeStamp");
        requestHeader.should.have.property("requestHandle");
        requestHeader.should.have.property("returnDiagnostics");
        requestHeader.should.have.property("auditEntryId");
        requestHeader.should.have.property("timeoutHint");
        requestHeader.should.have.property("additionalHeader");

    });
    it("should create a ResponseHeader", function () {


        function get_current_date_with_delta_seconds(date, delta) {
            var result = new Date(date);
            result.setTime(date.getTime() + delta * 1000);
            return result;

        }

        var date_before_construction = get_current_date_with_delta_seconds(new Date(), -1);

        var responseHeader = new ResponseHeader();

        responseHeader.should.have.property("timeStamp");
        responseHeader.should.have.property("requestHandle");
        responseHeader.should.have.property("serviceResult");
        responseHeader.should.have.property("stringTable");
        responseHeader.should.have.property("additionalHeader");
        responseHeader.stringTable.should.be.instanceOf(Array);

        responseHeader.timeStamp.should.be.instanceOf(Date);

        var date_after_construction = get_current_date_with_delta_seconds(new Date(), 1);

        //xx console.log("date_before_construction " ,date_before_construction , date_before_construction.getTime());
        //xx console.log("timestamp                " ,responseHeader.timeStamp , responseHeader.timeStamp.getTime());
        //xx console.log("date_after_construction  " ,date_after_construction  , date_after_construction.getTime());
        responseHeader.timeStamp.should.be.greaterThan(date_before_construction);
        responseHeader.timeStamp.should.be.lessThan(date_after_construction);
    });


});

describe("Testing ChannelSecurityToken", function () {

    it("should exposed a expired property", function () {

        var channelSecurityToken = new ChannelSecurityToken({});

        channelSecurityToken.revisedLifeTime.should.equal(30000);
        channelSecurityToken.createdAt.getTime().should.be.lessThan((new Date().getTime() + 1));
        (channelSecurityToken.expired).should.equal(false);

    });
    it("a ChannelSecurityToken should expired after the revisedLifeTime", function (done) {
        var channelSecurityToken = new ChannelSecurityToken({
            revisedLifeTime: 3
        });
        (channelSecurityToken.expired).should.equal(false);
        setTimeout(function () {
            (channelSecurityToken.expired).should.equal(true);
            done();
        }, 12);
    });


});

