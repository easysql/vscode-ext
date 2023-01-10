import { expect } from 'chai';
import { HighlightTokenParser, IParsedToken, TokenTypes } from './highlight';
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
});
