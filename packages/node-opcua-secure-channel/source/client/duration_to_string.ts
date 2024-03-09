const secondsInAMinute = 60;
const secondsInAnHour = secondsInAMinute * 60;
const secondsInADay = secondsInAnHour * 24;
const secondsInAYear = 365 * secondsInADay;

export function absoluteDurationToString(durationInMilliseconds: number) {
    const seconds = Math.abs(durationInMilliseconds / 1000);

    const numYears = Math.floor(seconds / secondsInAYear);
    const numDays = Math.floor((seconds % secondsInAYear) / secondsInADay);
    const numHours = Math.floor(((seconds % secondsInAYear) % secondsInADay) / secondsInAnHour);
    const numMinutes = Math.floor((((seconds % secondsInAYear) % secondsInADay) % secondsInAnHour) / secondsInAMinute);
    const numSeconds = ((((seconds % secondsInAYear) % secondsInADay) % secondsInAnHour) % secondsInAMinute).toFixed(3);

    const str: string[] = [];
    if (numYears !== 0) {
        return `${numYears} years ${numDays} days ${numHours} hours ${numMinutes} minutes ${numSeconds} seconds`;
    }
    if (numDays !== 0) {
        return `${numDays} days ${numHours} hours ${numMinutes} minutes ${numSeconds} seconds`;
    }
    if (numHours !== 0) {
        return `${numHours} hours ${numMinutes} minutes ${numSeconds} seconds`;
    }
    if (numMinutes !== 0) {
        return `${numMinutes} minutes ${numSeconds} seconds`;
    }
    return `${numSeconds} seconds`;
}
export function durationToString(durationInMilliseconds: number) {
    if (durationInMilliseconds < 0) {
        return `late by ${absoluteDurationToString(-durationInMilliseconds)}`;
    }
    return `early by ${absoluteDurationToString(durationInMilliseconds)}`;
}
