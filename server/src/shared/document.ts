export class LineNumberFinder {
    constructor(private content: string) {}
    private lineBreakIndices = Array.from(this.content.matchAll(/\n/g)).map((match) => match.index!);

    findLineNumber(pos: number) {
        if (!this.lineBreakIndices.length) {
            return [0, pos];
        }
        const lineNum = this.lineBreakIndices.findIndex((idx) => pos <= idx);
        return [lineNum, lineNum === 0 ? pos : pos - this.lineBreakIndices[lineNum - 1] - 1];
    }

    get lastLineNum() {
        return this.lineBreakIndices.length === 1 ? 0 : this.lineBreakIndices.length - 1;
    }
}
