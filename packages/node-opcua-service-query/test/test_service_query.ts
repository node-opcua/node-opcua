import * as service from "../dist/index.js";

describe("Query Service", () => {
    it("should create a QueryFirstRequest", () => {
        new service.QueryFirstRequest({});
    });
});
