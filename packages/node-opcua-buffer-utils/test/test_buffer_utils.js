"use strict";


var buffer_utils = require("..");
var createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

var Benchmarker = require("node-opcua-benchmarker").Benchmarker;


describe("testing buffer utils",function() {


    it("buffer_utils.createFastUninitializedBuffer should be faster than new Buffer(size)",function(done){

        var bench = new Benchmarker();

        var n = 1000;
        var sizes = [];
        for(var i=0;i<n;i++) {
            sizes.push(parseInt(""+Math.ceil(Math.random()*10000)));
        }
//xx        console.log(sizes);
        var a;
        for (i = 0; i < n; i++) {
            a = createFastUninitializedBuffer(sizes[i]);
            a =  new Buffer(sizes[i]);
        }

        bench
            .add("new Buffer(size)", function () {

                var bufs  = new Array(n);
                for (i = 0; i < n; i++) {
                    bufs[i] = createFastUninitializedBuffer(sizes[i]);
                }
                bufs = null;

            })
            .add("createFastUninitializedBuffer", function () {

                var bufs  = new Array(n);
                for (i = 0; i < n; i++) {
                    bufs[i] = new Buffer(sizes[i]);
                }
                bufs = null;

            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);

                done();
            })
            .run({max_time: 0.5});

    });
    
});