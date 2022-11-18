import { expect } from 'chai';
import { LineNumberFinder } from './document';
import { logger } from './logger';

logger.setLevel('DEBUG');

describe('line finder', () => {
    it('find line number', () => {
        expect(new LineNumberFinder('abc').findLineNumber(1)).to.deep.eq([0, 1]);
        expect(new LineNumberFinder('abc\n').findLineNumber(1)).to.deep.eq([0, 1]);
        expect(new LineNumberFinder('\n\nabc\n').findLineNumber(1)).to.deep.eq([1, 0]);
        expect(new LineNumberFinder('\n\nabc\n').findLineNumber(2)).to.deep.eq([2, 0]);
        expect(new LineNumberFinder('\n\nabc\n').findLineNumber(4)).to.deep.eq([2, 2]);
    });
});
