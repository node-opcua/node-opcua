require("requirish")._(module);

var Benchmarker = require("test/helpers/benchmarker").Benchmarker;


describe("Testing ", function () {


    it("forEach vs simple loops", function (done) {

        var bench = new Benchmarker();

        var values = [];
        for (var i = 0; i < 10000; i++) {
            values[i] = Math.random();
        }

        bench
            .add('for simple loop', function () {

                var sum = 0;
                for (i = 0; i < values.length; i++) {
                    sum += values[i];
                }

            })
            .add('forEach        ', function () {

                var sum = 0;
                values.forEach(function (e) {
                    sum += e;
                });

            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                console.log(' count    :  ', this.fastest.count);
                done();
            })
            .run({max_time: 0.1});

    });
});
