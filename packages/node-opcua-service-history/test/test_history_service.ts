import * as history_service from "..";

describe("History Service", () => {
    it("should create a HistoryReadDetails", () => {
        new history_service.HistoryReadDetails({});
    });

    it("should create a HistoryReadRequest", () => {
        new history_service.HistoryReadRequest({});
    });
    it("should create a HistoryReadResult", () => {
        new history_service.HistoryReadResult({});
    });
    it("should create a HistoryUpdateRequest", () => {
        new history_service.HistoryUpdateRequest({});
    });
    it("should create a HistoryUpdateResponse", () => {
        new history_service.HistoryUpdateResponse({});
    });
    it("should create a HistoryData", () => {
        new history_service.HistoryData({});
    });
});
