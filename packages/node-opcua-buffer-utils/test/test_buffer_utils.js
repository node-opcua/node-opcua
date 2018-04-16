"use strict";


const buffer_utils = require("..");
const createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

const Benchmarker = require("node-opcua-benchmarker").Benchmarker;


describe("testing buffer utils",function() {


    it("buffer_utils.createFastUninitializedBuffer should be faster than new Buffer(size)",function(done){

        const bench = new Benchmarker();

        const n = 1000;
        const sizes = [];
        let i;
        for(i=0;i<n;i++) {
            sizes.push(parseInt(""+Math.ceil(Math.random()*10000)));
        }
//xx        console.log(sizes);
        let a;
        for (i = 0; i < n; i++) {
            a = createFastUninitializedBuffer(sizes[i]);
            a =  new Buffer(sizes[i]);
        }

        bench
            .add("new Buffer(size)", function () {

                let bufs  = new Array(n);
                for (i = 0; i < n; i++) {
                    bufs[i] = createFastUninitializedBuffer(sizes[i]);
                }
                bufs = null;

            })
            .add("createFastUninitializedBuffer", function () {

                let bufs  = new Array(n);
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