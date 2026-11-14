import should from "should";
export const assertThrow = async (myAsyncFunction, regExp) => {
    try {
        await myAsyncFunction();
        const message = "Expected function to throw, but it did not";
        should.not.exist(message);
        throw new Error("Expected function to throw, but it did not");
    }
    catch (err) {
        should.exist(err);
        err.should.be.an.Error();
        err.message.should.match(regExp);
        return err;
    }
};
//# sourceMappingURL=assert_throw.js.map