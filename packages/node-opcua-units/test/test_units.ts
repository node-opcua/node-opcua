import { allUnits } from "..";
describe("Units", () => {
    it("should generate fancy units", () => {
        const u = allUnits["British_thermal_unit(international_table)_per_second_square_foot_degree_Rankine"];
        console.log(u.toString());
    });
});
