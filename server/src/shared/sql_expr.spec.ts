import { expect } from 'chai';
import { SqlExprStringFinder, StringFound } from './sql_expr';
import { logger } from './logger';

logger.setLevel('DEBUG');

describe('sql_expr', () => {
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
});
