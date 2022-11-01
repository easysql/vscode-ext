import { expect } from 'chai';
import {
    Any,
    Parser,
    Comment,
    Sentinel,
    SqlLine,
    Tok,
    TokType,
    TplReference,
    TplVarReference,
    Name,
    VarFuncCall,
    VarReference,
    Lit,
    TplFuncCall,
    TplFuncArg
} from './easysql';

let content = '';
let pos = 0;

const t = (text: string, type?: TokType) => {
    let tokType = type;
    if (!tokType) {
        switch (text) {
            case '${':
                tokType = Tok.TYPES.varCurlyBracketStart;
                break;
            case '@{':
                tokType = Tok.TYPES.tplCurlyBracketStart;
                break;
            case '#{':
                tokType = Tok.TYPES.tplVarCurlyBracketStart;
                break;
            case '}':
                tokType = Tok.TYPES.curlyBracketEnd;
                break;
            case '(':
                tokType = Tok.TYPES.parenthesisStart;
                break;
            case ')':
                tokType = Tok.TYPES.parenthesisEnd;
                break;
            case ',':
                tokType = Tok.TYPES.comma;
                break;
            default:
                throw new Error('unknown tok type!');
        }
    }

    const tok = new Tok(pos, text.length, content, tokType);
    pos += text.length;
    return tok;
};

describe('parser', () => {
    it('should test', () => {
        expect(1).to.eq(1);
    });
    it('should find comment start', () => {
        expect(new Parser().findCommentStart('--')).to.eq(0);
        expect(new Parser().findCommentStart('123--')).to.eq(3);
        expect(new Parser().findCommentStart('""--')).to.eq(2);
        expect(new Parser().findCommentStart('"--')).to.eq(-1);
        expect(new Parser().findCommentStart('"\'"--')).to.eq(3);
        expect(new Parser().findCommentStart('"\'"\'--')).to.eq(-1);
        expect(new Parser().findCommentStart('"\\""--')).to.eq(4);
        expect(new Parser().findCommentStart('`\\``--')).to.eq(4);
        expect(new Parser().findCommentStart("'\\''--")).to.eq(4);
        expect(new Parser().findCommentStart("'\\\\''--")).to.eq(-1);
        expect(new Parser().findCommentStart("'\\\\\\''--")).to.eq(6);
    });

    describe('should parse var reference', () => {
        it('var', () => {
            const parser = new Parser();
            content = '${var}';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new VarReference(new Sentinel([t('${')]), new Name(t('var', Tok.TYPES.name)), new Sentinel([t('}')]))
            );
        });
        it('tpl', () => {
            const parser = new Parser();
            content = '@{var}';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new TplReference(new Sentinel([t('@{')]), new Name(t('var', Tok.TYPES.name)), new Sentinel([t('}')]))
            );
        });
        it('empty tpl', () => {
            const parser = new Parser();
            content = '@{}';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new TplReference(new Sentinel([t('@{')]), new Name(t('', Tok.TYPES.name)), new Sentinel([t('}')]))
            );
        });
        it('tpl var', () => {
            const parser = new Parser();
            content = '#{}';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new TplVarReference(new Sentinel([t('#{')]), new Name(t('', Tok.TYPES.name)), new Sentinel([t('}')]))
            );
        });
        it('empty tpl with white space', () => {
            const parser = new Parser();
            content = '@{  }';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new TplReference(new Sentinel([t('@{'), t('  ', Tok.TYPES.whiteSpace)]), new Name(t('', Tok.TYPES.name)), new Sentinel([t('}')]))
            );
        });
        it('var with white space', () => {
            const parser = new Parser();
            content = '${ a }';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new VarReference(
                    new Sentinel([t('${'), t(' ', Tok.TYPES.whiteSpace)]),
                    new Name(t('a', Tok.TYPES.name)),
                    new Sentinel([t(' ', Tok.TYPES.whiteSpace), t('}')])
                )
            );
        });
    });

    describe('should parse func call', () => {
        it('no parameters', () => {
            const parser = new Parser();
            content = '${func()}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new VarFuncCall(
                    new Sentinel([t('${')]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('one parameter', () => {
            const parser = new Parser();
            content = '${func(var)}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new VarFuncCall(
                    new Sentinel([t('${')]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [new Lit(t('var', Tok.TYPES.nameWide))],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('empty second parameter', () => {
            const parser = new Parser();
            content = '${func(var,)}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new VarFuncCall(
                    new Sentinel([t('${')]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [new Lit(t('var', Tok.TYPES.nameWide)), new Sentinel([t(',')]), new Lit(t('', Tok.TYPES.nameWide))],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('func with leading space', () => {
            const parser = new Parser();
            content = '${ \tfunc()}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new VarFuncCall(
                    new Sentinel([t('${'), t(' \t', Tok.TYPES.whiteSpace)]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('parameters with space and var reference', () => {
            const parser = new Parser();
            content = '${func( var1, ${var2}, var3 )}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new VarFuncCall(
                    new Sentinel([t('${')]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new Sentinel([t(' ', Tok.TYPES.whiteSpace)]),
                        new Lit(t('var1', Tok.TYPES.nameWide)),
                        new Sentinel([t(','), t(' ', Tok.TYPES.whiteSpace)]),
                        new VarReference(new Sentinel([t('${')]), new Name(t('var2', Tok.TYPES.name)), new Sentinel([t('}')])),
                        new Sentinel([t(','), t(' ', Tok.TYPES.whiteSpace)]),
                        new Lit(t('var3', Tok.TYPES.nameWide)),
                        new Sentinel([t(' ', Tok.TYPES.whiteSpace)])
                    ],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('template with variables and new lines', () => {
            const parser = new Parser();
            content = '@{ func( var1 = var1\n, \nvar2= ${var2}, var3 =1 )}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new TplFuncCall(
                    new Sentinel([t('@{'), t(' ', Tok.TYPES.whiteSpace)]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new TplFuncArg(
                            new Sentinel([t(' ', Tok.TYPES.whiteSpace)]),
                            new Name(t('var1', Tok.TYPES.name)),
                            new Sentinel([t(' ', Tok.TYPES.whiteSpace), t('=', Tok.TYPES.assignment), t(' ', Tok.TYPES.whiteSpace)]),
                            new Lit(t('var1', Tok.TYPES.nameWide)),
                            new Sentinel([t('\n', Tok.TYPES.whiteSpace)])
                        ),
                        new Sentinel([t(',')]),
                        new TplFuncArg(
                            new Sentinel([t(' \n', Tok.TYPES.whiteSpace)]),
                            new Name(t('var2', Tok.TYPES.name)),
                            new Sentinel([t('=', Tok.TYPES.assignment), t(' ', Tok.TYPES.whiteSpace)]),
                            new VarReference(new Sentinel([t('${')]), new Name(t('var2', Tok.TYPES.name)), new Sentinel([t('}')])),
                            new Sentinel([])
                        ),
                        new Sentinel([t(',')]),
                        new TplFuncArg(
                            new Sentinel([t(' ', Tok.TYPES.whiteSpace)]),
                            new Name(t('var3', Tok.TYPES.name)),
                            new Sentinel([t(' ', Tok.TYPES.whiteSpace), t('=', Tok.TYPES.assignment)]),
                            new Lit(t('1', Tok.TYPES.nameWide)),
                            new Sentinel([t(' ', Tok.TYPES.whiteSpace)])
                        )
                    ],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('template with empty vars and spaces', () => {
            const parser = new Parser();
            content = '@{f(,var4, )}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new TplFuncCall(
                    new Sentinel([t('@{')]),
                    new Name(t('f', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new TplFuncArg(
                            new Sentinel([]),
                            new Name(t('', Tok.TYPES.name)),
                            new Sentinel([t('', Tok.TYPES.assignment)]),
                            new Lit(t('', Tok.TYPES.nameWide)),
                            new Sentinel([])
                        ),
                        new Sentinel([t(',')]),
                        new TplFuncArg(
                            new Sentinel([]),
                            new Name(t('var4', Tok.TYPES.name)),
                            new Sentinel([t('', Tok.TYPES.assignment)]),
                            new Lit(t('', Tok.TYPES.nameWide)),
                            new Sentinel([])
                        ),
                        new Sentinel([t(',')]),
                        new TplFuncArg(
                            new Sentinel([t(' ', Tok.TYPES.whiteSpace)]),
                            new Name(t('', Tok.TYPES.name)),
                            new Sentinel([t('', Tok.TYPES.assignment)]),
                            new Lit(t('', Tok.TYPES.nameWide)),
                            new Sentinel([])
                        )
                    ],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('space in the end', () => {
            const parser = new Parser();
            content = '@{f() }';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new TplFuncCall(
                    new Sentinel([t('@{')]),
                    new Name(t('f', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [],
                    new Sentinel([t(')'), t(' ', Tok.TYPES.whiteSpace), t('}')])
                )
            );
        });
    });

    describe('should parse all', () => {
        it('ignore comment', () => {
            const parser = new Parser();

            content = '--abc${lit}';
            pos = 0;
            expect(parser.parse(content, true)).to.deep.eq([
                new Any(t('--abc', Tok.TYPES.any)),
                new VarReference(new Sentinel([t('${')]), new Name(t('lit', Tok.TYPES.name)), new Sentinel([t('}')]))
            ]);
        });
        it('ignore comment and quotes', () => {
            const parser = new Parser();
            content = "ab'c${lit(a, ${b})}--";
            pos = 0;
            expect(parser.parse(content, true)).to.deep.eq([
                new Any(t("ab'c", Tok.TYPES.any)),
                new VarFuncCall(
                    new Sentinel([t('${')]),
                    new Name(t('lit', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new Lit(t('a', Tok.TYPES.nameWide)),
                        new Sentinel([t(','), t(' ', Tok.TYPES.whiteSpace)]),
                        new VarReference(new Sentinel([t('${')]), new Name(t('b', Tok.TYPES.name)), new Sentinel([t('}')]))
                    ],
                    new Sentinel([t(')'), t('}')])
                ),
                new Any(t('--', Tok.TYPES.any)) // in string, -- is not comment
            ]);
        });

        it('should ignore parsing when no identity chars found', () => {
            const parser = new Parser();
            content = '--abc$\\{lit(a, $\\{b})}';
            pos = 0;
            expect(parser.parse(content, true)).to.deep.eq([new Any(t('--abc$\\{lit(a, $\\{b})}', Tok.TYPES.any))]);
        });
        it('enable comment', () => {
            const parser = new Parser();
            content = '--abc${lit(a, ${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('abc${lit(a, ${b})}', Tok.TYPES.any))
            ]);

            content = 'xx--abc${lit(a, ${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('abc${lit(a, ${b})}', Tok.TYPES.any))
            ]);

            content = 'xx---abc${lit(a, ${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('-abc${lit(a, ${b})}', Tok.TYPES.any))
            ]);
        });

        it.skip('TODO: should ignore parsing when identity chars disabled', () => {
            const parser = new Parser();
            content = '--abc$${lit(a, ${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                t('--abc${lit(a, ', Tok.TYPES.any),
                t('${'),
                t('b', Tok.TYPES.name),
                t('}'),
                t(')}', Tok.TYPES.any)
            ]);
        });
    });
});
