"use strict";
var commonCodeToUInt = require("..").commonCodeToUInt;

describe("commonCodeToUInt", function () {

    it("commonCodeToUInt - CEL = °C = degree Celsius", function () {

        var unitId = commonCodeToUInt("CEL"); // °C
        unitId.should.eql(4408652);
    });

    it("commonCodeToUInt - LTR = l =  liter", function () {
        var unitId = commonCodeToUInt("LTR"); // °C
        unitId.should.eql(5002322);
    });
    it("commonCodeToUInt - BQL = Bq =  Becquerel = 27,027 x 1E-12 Ci  ", function () {
        var unitId = commonCodeToUInt("BQL"); // °C
        unitId.should.eql(4346188);
    });
    it("commonCodeToUInt - CUR = Ci = Curie = 3,7 x 1E10 Bq ", function () {
        var unitId = commonCodeToUInt("CUR"); // °C
        unitId.should.eql(4412754);
    });
    it("commonCodeToUInt - A53 = eV = ElectronVolt = 1,602 177 33 1E-19 J  ", function () {
        var unitId = commonCodeToUInt("A53"); // °C
        unitId.should.eql(4273459);
    });
    it("commonCodeToUInt - B71 = MeV = megaelectronvolt = 1E6 eV  ", function () {
        var unitId = commonCodeToUInt("B71"); // °C
        unitId.should.eql(4339505);
    });
    it("commonCodeToUInt - STL = l = standard liter", function () {
        var unitId = commonCodeToUInt("STL"); // °C
        unitId.should.eql(5461068);
    });
    it("commonCodeToUInt - A97 = hPa = hecto pascal", function () {
        var unitId = commonCodeToUInt("A97"); // °C
        unitId.should.eql(4274487);
    });

});
