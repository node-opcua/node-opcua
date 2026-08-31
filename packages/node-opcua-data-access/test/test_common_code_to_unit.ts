import { commonCodeToUInt, standardUnits } from "../dist/index.js";

describe("commonCodeToUInt", () => {
    it("commonCodeToUInt - CEL = °C = degree Celsius", () => {
        const unitId = commonCodeToUInt("CEL"); // °C
        unitId.should.eql(4408652);
    });

    it("commonCodeToUInt - LTR = l =  liter", () => {
        const unitId = commonCodeToUInt("LTR"); // °C
        unitId.should.eql(5002322);
    });
    it("commonCodeToUInt - BQL = Bq =  Becquerel = 27,027 x 1E-12 Ci  ", () => {
        const unitId = commonCodeToUInt("BQL"); // °C
        unitId.should.eql(4346188);
    });
    it("commonCodeToUInt - CUR = Ci = Curie = 3,7 x 1E10 Bq ", () => {
        const unitId = commonCodeToUInt("CUR"); // °C
        unitId.should.eql(4412754);
    });
    it("commonCodeToUInt - A53 = eV = ElectronVolt = 1,602 177 33 1E-19 J  ", () => {
        const unitId = commonCodeToUInt("A53"); // °C
        unitId.should.eql(4273459);
    });
    it("commonCodeToUInt - B71 = MeV = megaelectronvolt = 1E6 eV  ", () => {
        const unitId = commonCodeToUInt("B71"); // °C
        unitId.should.eql(4339505);
    });
    it("commonCodeToUInt - STL = l = standard liter", () => {
        const unitId = commonCodeToUInt("STL"); // °C
        unitId.should.eql(5461068);
    });
    it("commonCodeToUInt - A97 = hPa = hecto pascal", () => {
        const unitId = commonCodeToUInt("A97"); // °C
        unitId.should.eql(4274487);
    });
    it("commonCodeToUint - kelvin", () => {
        standardUnits.kelvin.unitId.should.eql(4932940);
    });
    it("commonCodeToUint - kilogram_per_squared_centimeter", () => {
        standardUnits.kilogram_per_squared_centimeter.unitId.should.eql(17461);
    });
});
