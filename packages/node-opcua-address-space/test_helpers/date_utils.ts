export function date_add(date: Date, options: { seconds: number }): Date {
    const date1 = new Date(date.getTime() + options.seconds * 1000);
    (date1 as any).picoseconds = 0;
    return date1;
}
