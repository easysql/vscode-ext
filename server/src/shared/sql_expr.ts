export interface StringPos {
    quoteChar: string;
    start: number;
    end: number;
}

export class StringFound {
    constructor(
        public text: string,
        public strings: StringPos[],
        public hasOpenQuote: boolean,
        public openQuote?: string,
        public openQuoteStart?: number
    ) {}

    findInStrs(pos: number): StringPos | undefined {
        return this.strings.find((strPos) => pos >= strPos.start && pos <= strPos.end);
    }

    getStrWithDoubleDashInside(): StringPos | undefined {
        const start = this.strings.length ? this.strings[0].start : 0;
        const pos = this.text.indexOf('--', start);
        return pos !== -1 ? this.findInStrs(pos) : undefined;
    }
}

export class SqlExprStringFinder {
    findString(contentLine: string): StringFound {
        const quoteChars = '\'"`';
        let openQuote = '';
        let openQuoteStart = -1;

        const stringPositions: StringPos[] = [];

        for (let i = 0; i < contentLine.length; i++) {
            const ch = contentLine.charAt(i);
            if (quoteChars.includes(ch)) {
                if (openQuote === ch) {
                    stringPositions.push({ quoteChar: openQuote, start: openQuoteStart, end: i });
                    openQuote = '';
                } else if (!openQuote) {
                    openQuote = ch;
                    openQuoteStart = i;
                }
            } else if (ch === '-' && contentLine.charAt(i + 1) === '-' && !openQuote) {
                // comment found, no need to parse any more
                return new StringFound(contentLine, stringPositions, false);
            }
        }
        if (openQuote) {
            return new StringFound(contentLine, stringPositions, true, openQuote, openQuoteStart);
        } else {
            return new StringFound(contentLine, stringPositions, false);
        }
    }
}
