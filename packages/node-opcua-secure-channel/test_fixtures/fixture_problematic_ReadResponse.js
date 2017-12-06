


var makebuffer_from_trace = require("node-opcua-debug").makebuffer_from_trace;


exports.packet_ReadResponse= makebuffer_from_trace(function () {
    /*
     00000000: 01 00 7a 02 87 bb 66 e8 6e 19 d1 01 e0 16 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03 00 00 00    ..z..;fhn.Q.`...................
     00000020: 0d c1 18 00 00 00 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 03 00    .A..............................
     00000040: 00 00 02 00 00 00 04 00 00 00 03 00 00 00 c4 c6 a9 cf 30 19 d1 01 87 bb 66 e8 6e 19 d1 01 09 03    ..............DF)O0.Q..;fhn.Q...
     00000060: 03 87 bb 66 e8 6e 19 d1 01 09 03 03 87 bb 66 e8 6e 19 d1 01 00 00 00 00                            ..;fhn.Q.....;fhn.Q.....
     */
});

