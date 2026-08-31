// biome-ignore-all lint/correctness/noUnusedFunctionParameters: the parameter names are the fixture this suite asserts on
import { getFunctionParameterNames } from "../dist/index.js";

describe("testing getFunctionParameterNames", () => {
    it("#getFunctionParameterNames", () => {
        getFunctionParameterNames(getFunctionParameterNames).should.eql(["func"]);
        getFunctionParameterNames((a, b, c, d) => {
            /** s */
        }).should.eql(["a", "b", "c", "d"]);
        getFunctionParameterNames((a, /*b,c,*/ d) => {
            /** s */
        }).should.eql(["a", "d"]);
        getFunctionParameterNames(() => {
            /** s */
        }).should.eql([]);
    });
});
