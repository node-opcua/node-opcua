import should from "should";

import { RequestHeader, ResponseHeader } from "..";

describe("testing OPCUA structures ", () => {
    it("should create a RequestHeader", () => {
        const requestHeader = new RequestHeader();

        requestHeader.should.have.property("authenticationToken");
        requestHeader.should.have.property("timestamp");
        requestHeader.should.have.property("requestHandle");
        requestHeader.should.have.property("returnDiagnostics");
        requestHeader.should.have.property("auditEntryId");
        requestHeader.should.have.property("timeoutHint");
        requestHeader.should.have.property("additionalHeader");
    });
    it("should create a ResponseHeader", () => {
        function get_current_date_with_delta_seconds(date: Date, delta: number) {
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
        should(responseHeader.stringTable).be.instanceOf(Array);

        const timestamp = responseHeader.timestamp;
        if (!timestamp) {
            throw new Error("expecting the ResponseHeader constructor to set a timestamp");
        }
        timestamp.should.be.instanceOf(Date);

        const date_after_construction = get_current_date_with_delta_seconds(new Date(), 1);

        //xx console.log("date_before_construction " ,date_before_construction , date_before_construction.getTime());
        //xx console.log("timestamp                " ,responseHeader.timestamp , responseHeader.timestamp.getTime());
        //xx console.log("date_after_construction  " ,date_after_construction  , date_after_construction.getTime());
        timestamp.getTime().should.be.greaterThan(date_before_construction.getTime());
        timestamp.getTime().should.be.lessThan(date_after_construction.getTime());
    });
});
