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
    TplFuncArg,
    Str,
    EasySQLContentFinder,
    Check,
    Variables,
    Condition,
    FuncCall,
    SinlgeFuncCallParser
} from './easysql';
import { logger } from './logger';

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
            case '.':
                tokType = Tok.TYPES.point;
                break;
            case '-- target':
                tokType = Tok.TYPES.targetStart;
                break;
            case '=':
                tokType = Tok.TYPES.assignment;
                break;
            default:
                throw new Error('unknown tok type ' + tokType + ' for text: ' + text);
        }
    }

    const tok = new Tok(pos, text.length, content, tokType);
    pos += text.length;
    return tok;
};

logger.setLevel('DEBUG');

describe('tok', () => {
    it('check valid', () => {
        expect(new Tok(0, 2, 'bc', Tok.TYPES.nameWide).isValid).to.true;
    });
});

describe('EasySQLContentFinder', () => {
    it('should find comment start', () => {
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('--')).to.eq(0);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('123--')).to.eq(3);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('""--')).to.eq(2);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('"--')).to.eq(-1);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('"\'"--')).to.eq(3);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('"\'"\'--')).to.eq(-1);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('""""--')).to.eq(4);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('````--')).to.eq(4);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine("''''--")).to.eq(4);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine("'''''--")).to.eq(-1);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine("''''''--")).to.eq(6);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('\n--')).to.eq(-1);
        expect(EasySQLContentFinder.findCommentStartInCurrentLine('abc\n--')).to.eq(-1);
    });

    it('should find open quote in the current line', () => {
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine('')).to.eq(-1);
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine('"')).to.eq(0);
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine('""\'')).to.eq(2);
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine('""\n\'')).to.eq(-1);
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine('"\'"\'')).to.eq(3);
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine("'''")).to.eq(2);
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine("''''")).to.eq(-1);
        expect(EasySQLContentFinder.findOpenQuoteInCurrentLine("''''\"")).to.eq(4);
    });
});

describe('SingleVarParser', () => {
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

        it('var with white space in between name', () => {
            const parser = new Parser();
            content = '${ a bc }';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new VarReference(
                    new Sentinel([t('${'), t(' ', Tok.TYPES.whiteSpace)]),
                    new Name(t('a bc', Tok.TYPES.name)),
                    new Sentinel([t(' ', Tok.TYPES.whiteSpace), t('}')])
                )
            );
        });

        it('var with line break', () => {
            const parser = new Parser();
            content = '${\n a\n }';
            pos = 0;
            expect(parser.parseSingleVar(content)).to.deep.eq(
                new VarReference(
                    new Sentinel([t('${'), t('\n ', Tok.TYPES.whiteSpace)]),
                    new Name(t('a', Tok.TYPES.name)),
                    new Sentinel([t('\n ', Tok.TYPES.whiteSpace), t('}')])
                )
            );
        });
    });
});

describe('SinlgeFuncCallParser', () => {
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

        it.only('one parameter without curly bracket', () => {
            const parser = new SinlgeFuncCallParser();
            content = 'func(var)';
            pos = 0;
            expect(parser.parse(content, true)).to.deep.eq(
                new FuncCall(
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [new Lit(t('var', Tok.TYPES.nameWide))],
                    new Sentinel([t(')')])
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

        it('func with line break', () => {
            const parser = new Parser();
            content = '${ \tfunc(\n)}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new VarFuncCall(
                    new Sentinel([t('${'), t(' \t', Tok.TYPES.whiteSpace)]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [new Sentinel([t('\n', Tok.TYPES.whiteSpace)])],
                    new Sentinel([t(')'), t('}')])
                )
            );
        });

        it('func with line break between args', () => {
            const parser = new Parser();
            content = '${ \tfunc(a\nb,\nb,\n, ${!!}, )}';
            pos = 0;
            expect(parser.parseSingleFuncCall(content)).to.deep.eq(
                new VarFuncCall(
                    new Sentinel([t('${'), t(' \t', Tok.TYPES.whiteSpace)]),
                    new Name(t('func', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new Lit(t('a\nb', Tok.TYPES.nameWide)),
                        new Sentinel([t(','), t('\n', Tok.TYPES.whiteSpace)]),
                        new Lit(t('b', Tok.TYPES.nameWide)),
                        new Sentinel([t(','), t('\n', Tok.TYPES.whiteSpace)]),
                        new Lit(t('', Tok.TYPES.nameWide)),
                        new Sentinel([t(','), t(' ', Tok.TYPES.whiteSpace)]),
                        new VarReference(new Sentinel([t('${')]), new Name(t('!!', Tok.TYPES.name)), new Sentinel([t('}')])),
                        new Sentinel([t(','), t(' ', Tok.TYPES.whiteSpace)]),
                        new Lit(t('', Tok.TYPES.nameWide))
                    ],
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
});

describe.only('target parser', () => {
    it('should parse simple variables target', () => {
        const parser = new Parser();
        content = '-- target=variables.a bc, if=bool()';
        pos = 0;
        expect(parser.parseTarget(content)).to.deep.eq(
            new Variables(
                new Sentinel([t('-- target'), t('='), t('variables', Tok.TYPES.name)]),
                null,
                new Sentinel([t('.a bc, if=bool()', Tok.TYPES.whiteSpace)]) // tolerant white-spaces.
            )
        );
    });

    it('should parse variables target with condition', () => {
        const parser = new Parser();
        content = '-- target=variables , if=bool()';
        pos = 0;
        expect(parser.parseTarget(content)).to.deep.eq(
            new Variables(
                new Sentinel([
                    t('-- target'),
                    t('='),
                    t('variables', Tok.TYPES.name),
                    t(' ', Tok.TYPES.whiteSpace),
                    t(','),
                    t(' ', Tok.TYPES.whiteSpace)
                ]),
                new Condition(
                    new Sentinel([t('if', Tok.TYPES.name), t('=')]),
                    new FuncCall(new Name(t('bool', Tok.TYPES.name)), new Sentinel([t('(')]), [], new Sentinel([t(')')])),
                    new Sentinel([])
                ),
                new Sentinel([])
            )
        );
    });
});

describe('body parser', () => {
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

        it('multi line tpl call', () => {
            const parser = new Parser();

            content = '--abc@{tpl(a=lit,\nb=${abc})}';
            pos = 0;
            expect(parser.parse(content, true)).to.deep.eq([
                new Any(t('--abc', Tok.TYPES.any)),
                new TplFuncCall(
                    new Sentinel([t('@{')]),
                    new Name(t('tpl', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new TplFuncArg(
                            new Sentinel([]),
                            new Name(t('a', Tok.TYPES.name)),
                            new Sentinel([t('=')]),
                            new Lit(t('lit', Tok.TYPES.nameWide)),
                            new Sentinel([])
                        ),
                        new Sentinel([t(',')]),
                        new TplFuncArg(
                            new Sentinel([t('\n', Tok.TYPES.whiteSpace)]),
                            new Name(t('b', Tok.TYPES.name)),
                            new Sentinel([t('=')]),
                            new VarReference(new Sentinel([t('${')]), new Name(t('abc', Tok.TYPES.name)), new Sentinel([t('}')])),
                            new Sentinel([])
                        )
                    ],
                    new Sentinel([t(')'), t('}')])
                )
            ]);
        });

        it('double multi line tpl call', () => {
            const parser = new Parser();

            content = '--abc@{tpl(a=lit,\nb=${abc})}  @{tpl(a=lit,\nb=${abc})}';
            pos = 0;
            expect(parser.parse(content, true)).to.deep.eq([
                new Any(t('--abc', Tok.TYPES.any)),
                new TplFuncCall(
                    new Sentinel([t('@{')]),
                    new Name(t('tpl', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new TplFuncArg(
                            new Sentinel([]),
                            new Name(t('a', Tok.TYPES.name)),
                            new Sentinel([t('=')]),
                            new Lit(t('lit', Tok.TYPES.nameWide)),
                            new Sentinel([])
                        ),
                        new Sentinel([t(',')]),
                        new TplFuncArg(
                            new Sentinel([t('\n', Tok.TYPES.whiteSpace)]),
                            new Name(t('b', Tok.TYPES.name)),
                            new Sentinel([t('=')]),
                            new VarReference(new Sentinel([t('${')]), new Name(t('abc', Tok.TYPES.name)), new Sentinel([t('}')])),
                            new Sentinel([])
                        )
                    ],
                    new Sentinel([t(')'), t('}')])
                ),
                new Any(t('  ', Tok.TYPES.any)),
                new TplFuncCall(
                    new Sentinel([t('@{')]),
                    new Name(t('tpl', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new TplFuncArg(
                            new Sentinel([]),
                            new Name(t('a', Tok.TYPES.name)),
                            new Sentinel([t('=')]),
                            new Lit(t('lit', Tok.TYPES.nameWide)),
                            new Sentinel([])
                        ),
                        new Sentinel([t(',')]),
                        new TplFuncArg(
                            new Sentinel([t('\n', Tok.TYPES.whiteSpace)]),
                            new Name(t('b', Tok.TYPES.name)),
                            new Sentinel([t('=')]),
                            new VarReference(new Sentinel([t('${')]), new Name(t('abc', Tok.TYPES.name)), new Sentinel([t('}')])),
                            new Sentinel([])
                        )
                    ],
                    new Sentinel([t(')'), t('}')])
                )
            ]);
        });

        it('ignore comment and quotes', () => {
            const parser = new Parser();
            content = "ab'c${lit(a, ${b})}--";
            pos = 0;
            expect(parser.parse(content, true, true)).to.deep.eq([
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
        it('comment at the head', () => {
            const parser = new Parser();
            content = '--abc${lit(a, ${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('abc${lit(a, ${b})}', Tok.TYPES.any))
            ]);
        });
        it('comment in the middle', () => {
            const parser = new Parser();
            content = 'xx--abc${lit(a, ${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('abc${lit(a, ${b})}', Tok.TYPES.any))
            ]);
        });
        it('comment with more dash', () => {
            const parser = new Parser();
            content = 'xx---abc${lit(a, ${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('-abc${lit(a, ${b})}', Tok.TYPES.any))
            ]);
        });

        it('multi line comment with string', () => {
            const parser = new Parser();
            content = '\nc${lit}("a"\n\n';
            pos = 0;
            console.log(parser.parse(content));
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('\n', Tok.TYPES.any)),
                new Any(t('c', Tok.TYPES.any)),
                new VarReference(new Sentinel([t('${')]), new Name(t('lit', Tok.TYPES.name)), new Sentinel([t('}')])),
                new Any(t('(', Tok.TYPES.any)),
                new Str(t('"a"', Tok.TYPES.any)),
                new Any(t('\n', Tok.TYPES.any)),
                new Any(t('\n', Tok.TYPES.any))
            ]);
        });

        it('space and var reference in string', () => {
            const parser = new Parser();
            content = "select ' ${abc}' from 123 -- comment";
            pos = 0;
            console.log(parser.parse(content));
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('select ', Tok.TYPES.any)),
                new Str(t("' ", Tok.TYPES.any)),
                new VarReference(new Sentinel([t('${')]), new Name(t('abc', Tok.TYPES.name)), new Sentinel([t('}')])),
                new Str(t("'", Tok.TYPES.quote)),
                new Any(t(' from 123 ', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t(' comment', Tok.TYPES.any))
            ]);
        });

        it('multi line tpl call with comment inside', () => {
            const parser = new Parser();
            content = 'xx"", @{lib(--abc\na=3)}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Str(t('""', Tok.TYPES.any)),
                new Any(t(', @{lib(', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('abc', Tok.TYPES.any)),
                new Any(t('\n', Tok.TYPES.any)),
                new Any(t('a=3)}', Tok.TYPES.any))
            ]);
        });

        it('multi line comment with string', () => {
            const parser = new Parser();
            content = 'xx"", ---abc${\nlit("a", --${b})}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Str(t('""', Tok.TYPES.any)),
                new Any(t(', ', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('-abc${', Tok.TYPES.any)),
                new Any(t('\n', Tok.TYPES.any)),
                new Any(t('lit(', Tok.TYPES.any)),
                new Str(t('"a"', Tok.TYPES.any)),
                new Any(t(', ', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('${b})}', Tok.TYPES.any))
            ]);
        });

        it('multi line var/func with string', () => {
            const parser = new Parser();
            content = 'xx"aa${a} ${f()}#{abc} @{t(a=1,"")}"\n`@{abc}';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Str(t('"aa', Tok.TYPES.any)),
                new VarReference(new Sentinel([t('${')]), new Name(t('a', Tok.TYPES.name)), new Sentinel([t('}')])),
                new Str(t(' ', Tok.TYPES.any)),
                new VarFuncCall(
                    new Sentinel([t('${')]),
                    new Name(t('f', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [],
                    new Sentinel([t(')'), t('}')])
                ),
                new TplVarReference(new Sentinel([t('#{')]), new Name(t('abc', Tok.TYPES.name)), new Sentinel([t('}')])),
                new Str(t(' @{t(a=1,"', Tok.TYPES.any)),
                new Str(t('")}"', Tok.TYPES.any)),
                new Any(t('\n', Tok.TYPES.any)),
                new Str(t('`@{abc}', Tok.TYPES.any))
            ]);
        });

        it('multi line comment with open quote', () => {
            const parser = new Parser();
            content = 'xx"", \'--${abc}\nlit("a", --${b})}\nabc';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t('xx', Tok.TYPES.any)),
                new Str(t('""', Tok.TYPES.any)),
                new Any(t(', ', Tok.TYPES.any)),
                new Str(t("'--${abc}", Tok.TYPES.any)),
                new Any(t('\n', Tok.TYPES.any)),
                new Any(t('lit(', Tok.TYPES.any)),
                new Str(t('"a"', Tok.TYPES.any)),
                new Any(t(', ', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t('${b})}', Tok.TYPES.any)),
                new Any(t('\n', Tok.TYPES.any)),
                new Any(t('abc', Tok.TYPES.any))
            ]);
        });

        it('invalid quote in var func call', () => {
            const parser = new Parser();
            content = '${f(a=1,asdf=,${f(x)})} as abcde -- com';
            pos = 0;
            console.log(JSON.stringify(parser.parse(content), null, 2));
            expect(parser.parse(content)).to.deep.eq([
                new VarFuncCall(
                    new Sentinel([t('${')]),
                    new Name(t('f', Tok.TYPES.name)),
                    new Sentinel([t('(')]),
                    [
                        new Lit(t('a=1', Tok.TYPES.nameWide)),
                        new Sentinel([t(',')]),
                        new Lit(t('asdf=', Tok.TYPES.nameWide)),
                        new Sentinel([t(',')]),
                        new Lit(t('${f(x', Tok.TYPES.nameWide))
                    ],
                    new Sentinel([t(')'), t('}')])
                ),
                new Any(t(')} as abcde ', Tok.TYPES.any)),
                new Comment(new Sentinel([t('--', Tok.TYPES.commentStart)]), t(' com', Tok.TYPES.any))
            ]);
        });

        it('invalid var reference in string', () => {
            const parser = new Parser();
            content = ', `${a,bc}d` as abcde';
            pos = 0;
            expect(parser.parse(content)).to.deep.eq([
                new Any(t(', ', Tok.TYPES.any)),
                new Str(t('`', Tok.TYPES.quote)),
                new VarReference(new Sentinel([t('${')]), new Name(t('a,bc', Tok.TYPES.name)), new Sentinel([t('}')])),
                new Str(t('d`', Tok.TYPES.any)),
                new Any(t(' as abcde', Tok.TYPES.any))
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
