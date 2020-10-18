export function roundToFloat2(float: number): number {
    if (float === 0) {
        return float;
    }
    // this method artificially rounds a float to 7 significant digit in base 10
    // Note:
    //   this is to overcome the that that Javascript doesn't  provide  single precision float values (32 bits)
    //   but only double precision float values

    // wikipedia:(http://en.wikipedia.org/wiki/Floating_point)
    //
    // * Single precision, usually used to represent the "float" type in the C language family
    //   (though this is not guaranteed). This is a binary format that occupies 32 bits (4 bytes) and its
    //   significand has a precision of 24 bits (about 7 decimal digits).
    // * Double precision, usually used to represent the "double" type in the C language family
    //   (though this is not guaranteed). This is a binary format that occupies 64 bits (8 bytes) and its
    //   significand has a precision of 53 bits (about 16 decimal digits).
    //
    const nbDigits = Math.ceil(Math.log(Math.abs(float)) / Math.log(10));
    const scale = Math.pow(10, -nbDigits + 2);
    return Math.round(float * scale) / scale;
    // return (float > 0 && r < 0) || (float < 0 && r > 0) ? -r : r;
}
