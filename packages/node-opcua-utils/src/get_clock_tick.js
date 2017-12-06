"use strict";
var get_clock_tick ;

if (process.hrtime) {

    var tick_origin = process.hrtime()[0];
// clock it as a double in millisecond
// so we can measure very tiny time intervals
    get_clock_tick = function get_clock_tick() {
        var hrt =  process.hrtime();
        var r =  (hrt[0]-tick_origin)*1000.0 +  Math.ceil(hrt[1]/1E6*1000)/1000;
        return r;
        // Date.now();
    };

} else {
    get_clock_tick = function get_clock_tick() {
        return (new Date()).getTime();
    };
}

exports.get_clock_tick = get_clock_tick;
