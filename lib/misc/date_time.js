"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

(function () {

    var assert = require("better-assert");
    var _ = require("underscore");

    var offset_factor_1601 = (function () {

        var utc1600 = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));
        var t1600 = utc1600.getTime();

        var utc1600_plus_one_day = new Date(Date.UTC(1601, 0, 2, 0, 0, 0));
        var t1600_1d = utc1600_plus_one_day.getTime();

        var factor = (24 * 60 * 60 * 1000) * 10000 / (t1600_1d - t1600);

        var utc1970 = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
        var t1970 = utc1970.getTime();

        var offsetToGregorianCalendarZero = -t1600 + t1970;

        assert(factor === 10000);
        assert(offsetToGregorianCalendarZero === 11644473600000);
        return [offsetToGregorianCalendarZero, factor];

    })();

    exports.offset_factor_1601 = offset_factor_1601;

    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];

    var F = 0x100000000;
    var A = factor / F;
    var B = offset * A;
    var oh = Math.floor(offset / F);
    var ol = offset % F;
    var fl = factor % F;
    var F_div_factor = ( F / factor);

    // Extracted from OpcUA Spec v1.02 : part 6:
    //
    // 5.2.2.5 DateTime
    // A DateTime value shall be encoded as a 64-bit signed integer (see Clause 5.2.2.2) which represents
    // the number of 100 nanosecond intervals since January 1, 1601 (UTC) .
    // Not all DevelopmentPlatforms will be able to represent the full range of dates and times that can be
    // represented with this DataEncoding. For example, the UNIX time_t structure only has a 1 second
    // resolution and cannot represent dates prior to 1970. For this reason, a number of rules shall be
    // applied when dealing with date/time values that exceed the dynamic range of a DevelopmentPlatform.
    //
    // These rules are:
    // a) A date/time value is encoded as 0 if either
    //    1) The value is equal to or earlier than 1601-01-01 12:00AM.
    //    2) The value is the earliest date that can be represented with the DevelopmentPlatform‟s encoding.
    //
    // b) A date/time is encoded as the maximum value for an Int64 if either
    //     1) The value is equal to or greater than 9999-01-01 11:59:59PM,
    //     2) The value is the latest date that can be represented with the DevelopmentPlatform‟s encoding.
    //
    // c) A date/time is decoded as the earliest time that can be represented on the platform if either
    //    1) The encoded value is 0,
    //    2) The encoded value represents a time earlier than the earliest time that can be
    //       represented with the DevelopmentPlatform‟s encoding.
    //
    //  d) A date/time is decoded as the latest time that can be represented on the platform if either
    //    1) The encoded value is the maximum value for an Int64,
    //    2) The encoded value represents a time later than the latest time that can be represented with the
    //       DevelopmentPlatform‟s encoding.
    //
    // These rules imply that the earliest and latest times that can be represented on a given platform are
    // invalid date/time values and should be treated that way by Applications.
    // A decoder shall truncate the value if a decoder encounters a DateTime value with a resolution that is
    // greater than the resolution supported on the DevelopmentPlatform.
    //
    function bn_dateToHundredNanoSecondFrom1601_fast(date) {
        assert(date instanceof Date);
        if (date.high_low) {
            return date.high_low;
        }

        // note : The value returned by the getTime method is the number
        //        of milliseconds since 1 January 1970 00:00:00 UTC.
        //
        var t = date.getTime(); // number of milliseconds since since 1 January 1970 00:00:00 UTC.

        //Note:
        // The number of 100-nano since 1 Jan 1601 is given by the formula :
        //
        //           value_64 = (t + offset ) * factor;
        //
        // However this number is too large and shall be converted to a 64 bits integer
        //
        // Let say that value_64 = (value_h * 0xFFFFFFFF ) + value_l, where value_h and value_l are two 32bits integers.
        //
        //  Let say F = 0x100000000
        //  (value_h * F ) + value_l =  (t+ offset)*factor;
        //
        //  value_h =  (t+ offset)*factor // F;
        //  value_l =  (t+ offset)*factor %  F;
        //
        //  value_h =  floor(t * factor / F + offset*factor / F)
        //             floor(t * A                    + B)
        //
        //  value_l = ((t % F + offset % F) * (factor % F) )% F
        //  value_l = ((t % F + ol        ) * fl           )% F

        var value_h = Math.floor(t * A + B);
        var value_l = ( ( t % F + ol ) * fl ) % F;
        value_l = ( value_l + F ) % F;
        var high_low = [value_h, value_l];
        Object.defineProperty(date, "high_low", {
            get: function () {
                return high_low;
            }, enumerable: false
        });
        return high_low;
    }

    exports.bn_dateToHundredNanoSecondFrom1601 = bn_dateToHundredNanoSecondFrom1601_fast;

    function bn_hundredNanoSecondFrom1601ToDate_fast(high, low) {
        //xx assert(_.isFinite(high), _.isFinite(low));

        //   (h * F + l)/f    - o=
        //    h / f * F + l/f - o=
        //
        //    h   = ((h div f)* f + h % f)
        //    h/f =     (h div f)   + (h % f) /f
        //    h/f * F = (h div f)*F + (h % f) * F/f
        //    o = oh * F + ol
        var value1 = (Math.floor(high / factor) - oh ) * F + Math.floor(( high % factor ) * F_div_factor + low / factor) - ol;
        var date = new Date(value1);
        // enrich the date
        Object.defineProperty(date, "high_low", {
            get: function () {
                return [high, low];
            }, enumerable: false
        });
        return date;
    }

    exports.bn_hundredNanoSecondFrom1601ToDate = bn_hundredNanoSecondFrom1601ToDate_fast;

}());
