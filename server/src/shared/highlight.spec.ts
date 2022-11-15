import { expect } from 'chai';
import { HighlightTokenParser, IParsedToken, LineNumberFinder, SqlExprStringFinder, StringFound, TokenTypes } from './highlight';
import { logger } from './logger';

logger.setLevel('DEBUG');

describe('highlight', () => {
    it('should parse tokens', () => {
        const content = `
-- some comment, should ignore
select \${abc} from 123 -- comment \${xx} -- some thing
        `;
        const expected: IParsedToken[] = [
            { line: 2, startCharacter: 'select '.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 2, startCharacter: 'select ${'.length, length: 3, tokenType: TokenTypes.variable },
            { line: 2, startCharacter: 'select ${abc'.length, length: 1, tokenType: TokenTypes.operatorEnd }
        ];

        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    it('should parse tokens with string', () => {
        const content = `
-- some comment, should ignore
select '--' \${abc } from 123 -- comment \${xx}
        `;
        const expected: IParsedToken[] = [
            { line: 2, startCharacter: 'select '.length, length: 4, tokenType: TokenTypes.string },
            { line: 2, startCharacter: "select '--' ".length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 2, startCharacter: "select '--' ${".length, length: 3, tokenType: TokenTypes.variable },
            { line: 2, startCharacter: "select '--' ${abc ".length, length: 1, tokenType: TokenTypes.operatorEnd }
        ];

        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    it('should parse tokens with var reference in string', () => {
        const content = `
-- some comment, should ignore
select ' \${abc}' from 123 -- comment
        `;
        const expected: IParsedToken[] = [
            { line: 2, startCharacter: 'select '.length, length: 2, tokenType: TokenTypes.string },
            { line: 2, startCharacter: "select ' ".length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 2, startCharacter: "select ' ${".length, length: 3, tokenType: TokenTypes.variable },
            { line: 2, startCharacter: "select ' ${abc".length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 2, startCharacter: "select ' ${abc}".length, length: 1, tokenType: TokenTypes.string }
        ];

        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    it('should parse tokens with quote in string', () => {
        const content = `
-- some comment, should ignore
select \`"' \${abc} \` from 123 -- comment
        `;
        const expected: IParsedToken[] = [
            { line: 2, startCharacter: 'select '.length, length: 4, tokenType: TokenTypes.string },
            { line: 2, startCharacter: 'select `"\' '.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 2, startCharacter: 'select `"\' ${'.length, length: 3, tokenType: TokenTypes.variable },
            { line: 2, startCharacter: 'select `"\' ${abc'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 2, startCharacter: 'select `"\' ${abc}'.length, length: 2, tokenType: TokenTypes.string }
        ];

        console.log(new HighlightTokenParser().parse(content));
        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    it('should parse tokens with invalid var reference in string', () => {
        const content = `
-- some comment, should ignore
select \`"' \${???} \` 'from 123 -- comment
        `;
        const expected: IParsedToken[] = [
            { line: 2, startCharacter: 'select '.length, length: 4, tokenType: TokenTypes.string },
            { line: 2, startCharacter: 'select `"\' '.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 2, startCharacter: 'select `"\' ${'.length, length: 3, tokenType: TokenTypes.invalid },
            { line: 2, startCharacter: 'select `"\' ${???'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 2, startCharacter: 'select `"\' ${???}'.length, length: 2, tokenType: TokenTypes.string },
            { line: 2, startCharacter: 'select `"\' ${???} ` '.length, length: "'from 123 -- comment".length, tokenType: TokenTypes.string }
        ];

        console.log(new HighlightTokenParser().parse(content));
        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    it('should parse tokens with invalid func reference in string', () => {
        const content = `
select \${?(,\${ !})}
        `;
        const expected: IParsedToken[] = [
            { line: 1, startCharacter: 'select '.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 1, startCharacter: 'select ${'.length, length: 1, tokenType: TokenTypes.invalid },
            { line: 1, startCharacter: 'select ${?'.length, length: 1, tokenType: TokenTypes.operatorBegin },
            { line: 1, startCharacter: 'select ${?(,'.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 1, startCharacter: 'select ${?(,${ '.length, length: 1, tokenType: TokenTypes.invalid },
            { line: 1, startCharacter: 'select ${?(,${ !'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 1, startCharacter: 'select ${?(,${ !}'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 1, startCharacter: 'select ${?(,${ !})'.length, length: 1, tokenType: TokenTypes.operatorEnd }
        ];

        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    it('should parse tokens with tpl call in string', () => {
        const content = `
select #{xx} @{a(,\na=b\n,c=\${a})}
        `;
        const expected: IParsedToken[] = [
            { line: 1, startCharacter: 'select '.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 1, startCharacter: 'select #{'.length, length: 2, tokenType: TokenTypes.variable },
            { line: 1, startCharacter: 'select #{xx'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 1, startCharacter: 'select #{xx} '.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 1, startCharacter: 'select #{xx} @{'.length, length: 1, tokenType: TokenTypes.function },
            { line: 1, startCharacter: 'select #{xx} @{a'.length, length: 1, tokenType: TokenTypes.operatorBegin },
            { line: 2, startCharacter: ''.length, length: 1, tokenType: TokenTypes.parameterName },
            { line: 2, startCharacter: 'a'.length, length: 1, tokenType: TokenTypes.operator },
            { line: 2, startCharacter: 'a='.length, length: 1, tokenType: TokenTypes.literal },
            { line: 3, startCharacter: ','.length, length: 1, tokenType: TokenTypes.parameterName },
            { line: 3, startCharacter: ',c'.length, length: 1, tokenType: TokenTypes.operator },
            { line: 3, startCharacter: ',c='.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 3, startCharacter: ',c=${'.length, length: 1, tokenType: TokenTypes.variable },
            { line: 3, startCharacter: ',c=${a'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 3, startCharacter: ',c=${a}'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 3, startCharacter: ',c=${a})'.length, length: 1, tokenType: TokenTypes.operatorEnd }
        ];

        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    it('should parse func', () => {
        const content = `
, \`\${fn(a,bc)}d\` as abcde
        `;
        const expected: IParsedToken[] = [
            { line: 1, startCharacter: ', '.length, length: 1, tokenType: TokenTypes.string },
            { line: 1, startCharacter: ', `'.length, length: 2, tokenType: TokenTypes.operatorBegin },
            { line: 1, startCharacter: ', `${'.length, length: 2, tokenType: TokenTypes.function },
            { line: 1, startCharacter: ', `${fn'.length, length: 1, tokenType: TokenTypes.operatorBegin },
            { line: 1, startCharacter: ', `${fn('.length, length: 1, tokenType: TokenTypes.literal },
            { line: 1, startCharacter: ', `${fn(a,'.length, length: 2, tokenType: TokenTypes.literal },
            { line: 1, startCharacter: ', `${fn(a,bc'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 1, startCharacter: ', `${fn(a,bc)'.length, length: 1, tokenType: TokenTypes.operatorEnd },
            { line: 1, startCharacter: ', `${fn(a,bc)}'.length, length: 2, tokenType: TokenTypes.string }
        ];

        console.log(new HighlightTokenParser().parse(content));
        expect(new HighlightTokenParser().parse(content)).to.deep.eq(expected);
    });

    describe('string finder should find string', () => {
        it('simple string', () => {
            const str = " 'abc'";
            const expected: StringFound = new StringFound(str, [{ quoteChar: "'", start: 1, end: 5 }], false);
            expect(new SqlExprStringFinder().findString(str)).to.deep.eq(expected);
        });

        it('simple string', () => {
            const str = ' `abc`';
            const expected: StringFound = new StringFound(str, [{ quoteChar: '`', start: 1, end: 5 }], false);
            expect(new SqlExprStringFinder().findString(str)).to.deep.eq(expected);
        });

        it('quote char in string', () => {
            const str = " '\"`abc'";
            const expected: StringFound = new StringFound(str, [{ quoteChar: "'", start: 1, end: 7 }], false);
            expect(new SqlExprStringFinder().findString(str)).to.deep.eq(expected);
        });

        it('string after comment', () => {
            const str = " --'\"`abc'";
            const expected: StringFound = new StringFound(str, [], false);
            expect(new SqlExprStringFinder().findString(str)).to.deep.eq(expected);
        });

        it('string with open quote', () => {
            const str = ' \'"`abc\' "';
            const expected: StringFound = new StringFound(str, [{ quoteChar: "'", start: 1, end: 7 }], true, '"', 9);
            expect(new SqlExprStringFinder().findString(str)).to.deep.eq(expected);
        });

        it('string with quote inside and open quote', () => {
            const str = " '''\"`abc' \"";
            const expected: StringFound = new StringFound(
                str,
                [
                    { quoteChar: "'", start: 1, end: 2 },
                    { quoteChar: "'", start: 3, end: 9 }
                ],
                true,
                '"',
                11
            );
            expect(new SqlExprStringFinder().findString(str)).to.deep.eq(expected);
        });
    });

    describe('string found', () => {
        it('should get str with double dash inside', () => {
            expect(new StringFound('"" --', [{ quoteChar: '"', start: 0, end: 2 }], false).getStrWithDoubleDashInside()).to.be.undefined;
            expect(new StringFound('"--" ', [{ quoteChar: '"', start: 0, end: 4 }], false).getStrWithDoubleDashInside()).to.deep.eq({
                quoteChar: '"',
                start: 0,
                end: 4
            });

            expect(
                new StringFound(
                    '"", "--" ',
                    [
                        { quoteChar: '"', start: 0, end: 2 },
                        { quoteChar: '"', start: 5, end: 9 }
                    ],
                    false
                ).getStrWithDoubleDashInside()
            ).to.deep.eq({
                quoteChar: '"',
                start: 5,
                end: 9
            });
        });
    });

    describe('line finder', () => {
        it('find line number', () => {
            expect(new LineNumberFinder('abc').findLineNumber(1)).to.deep.eq([0, 1]);
            expect(new LineNumberFinder('abc\n').findLineNumber(1)).to.deep.eq([0, 1]);
            expect(new LineNumberFinder('\n\nabc\n').findLineNumber(1)).to.deep.eq([1, 0]);
            expect(new LineNumberFinder('\n\nabc\n').findLineNumber(2)).to.deep.eq([2, 0]);
            expect(new LineNumberFinder('\n\nabc\n').findLineNumber(4)).to.deep.eq([2, 2]);
        });
    });
});
