



export class IndexIterator {

    public current: number[] | null = null;
    constructor(private limits: number[]) {
        this.reset();
    }
    public reset() {
        this.current = [];
        for (let i = 0; i < this.limits.length; i++) {
            this.current[i] = 0;
        }
    }
    public increment() {
        if (!this.current) return;


        const increase = (n: number): boolean => {
            if (n < 0) {
                return false;
            }
            if (!this.current) return false;
            if (this.current[n] + 1 >= this.limits[n]) {
                if (n==0) {
                    this.current = null;
                    return false;
                }
                this.current[n] = 0;
                return increase(n - 1);
            }
            this.current[n] = this.current[n] + 1;
            return true;
        }
        const n = this.limits.length - 1;
        if (!increase(n)) {
            this.current = null;
        }
    }
    public next(): number[] {
        if (!this.current) {
            throw new Error("Outof bond");
        }
        const r = [... this.current];
        this.increment();
        return r;
    }


}