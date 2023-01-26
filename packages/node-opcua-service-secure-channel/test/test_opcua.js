"use strict";
const should = require("should");

const { RequestHeader, ResponseHeader } = require("..");

describe("testing OPCUA structures ", function () {
    it("should create a RequestHeader", function () {
        const requestHeader = new RequestHeader();

        requestHeader.should.have.property("authenticationToken");
        requestHeader.should.have.property("timestamp");
        requestHeader.should.have.property("requestHandle");
        requestHeader.should.have.property("returnDiagnostics");
        requestHeader.should.have.property("auditEntryId");
        requestHeader.should.have.property("timeoutHint");
        requestHeader.should.have.property("additionalHeader");
    });
    it("should create a ResponseHeader", function () {
        function get_current_date_with_delta_seconds(date, delta) {
            const result = new Date(date);
            result.setTime(date.getTime() + delta * 1000);
            return result;
        }

        const date_before_construction = get_current_date_with_delta_seconds(new Date(), -1);

        const responseHeader = new ResponseHeader();

        responseHeader.should.have.property("timestamp");
        responseHeader.should.have.property("requestHandle");
        responseHeader.should.have.property("serviceResult");
        responseHeader.should.have.property("stringTable");
        responseHeader.should.have.property("additionalHeader");
        responseHeader.stringTable.should.be.instanceOf(Array);

        responseHeader.timestamp.should.be.instanceOf(Date);

        const date_after_construction = get_current_date_with_delta_seconds(new Date(), 1);

        //xx console.log("date_before_construction " ,date_before_construction , date_before_construction.getTime());
        //xx console.log("timestamp                " ,responseHeader.timestamp , responseHeader.timestamp.getTime());
        //xx console.log("date_after_construction  " ,date_after_construction  , date_after_construction.getTime());
        responseHeader.timestamp.should.be.greaterThan(date_before_construction);
        responseHeader.timestamp.should.be.lessThan(date_after_construction);
    });
});
