"use strict";
var history_service = require("..");
describe("History Service",function() {

    it("should create a HistoryReadDetails",function() {
         new history_service.HistoryReadDetails({});
    });

    it("should create a HistoryReadRequest",function() {
        new history_service.HistoryReadRequest({});
    });
    it("should create a HistoryReadResult",function() {
        new history_service.HistoryReadResult({});
    });
    it("should create a HistoryUpdateRequest",function() {
        new history_service.HistoryUpdateRequest({});
    });
    it("should create a HistoryUpdateResponse",function() {
        new history_service.HistoryUpdateResponse({});
    });
    it("should create a HistoryData",function() {
        new history_service.HistoryData({});
    });

});