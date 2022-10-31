import { expect } from 'chai';
import { Lexer, SemanticAnalyzer, Tok, TokType } from './easysql';

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

describe('lexer', () => {
    it('should test', () => {
        expect(1).to.eq(1);
    });
    it('should find comment start', () => {
        expect(new Lexer().findCommentStart('--')).to.eq(0);
        expect(new Lexer().findCommentStart('123--')).to.eq(3);
        expect(new Lexer().findCommentStart('""--')).to.eq(2);
        expect(new Lexer().findCommentStart('"--')).to.eq(-1);
        expect(new Lexer().findCommentStart('"\'"--')).to.eq(3);
        expect(new Lexer().findCommentStart('"\'"\'--')).to.eq(-1);
        expect(new Lexer().findCommentStart('"\\""--')).to.eq(4);
        expect(new Lexer().findCommentStart('`\\``--')).to.eq(4);
        expect(new Lexer().findCommentStart("'\\''--")).to.eq(4);
        expect(new Lexer().findCommentStart("'\\\\''--")).to.eq(-1);
        expect(new Lexer().findCommentStart("'\\\\\\''--")).to.eq(6);
    });

    describe('should identify var reference', () => {
        it('var', () => {
            const lexer = new Lexer();
            content = '${var}';
            pos = 0;
            expect(lexer.analyzeSingleVar(content)).to.deep.eq([t('${'), t('var', Tok.TYPES.name), t('}')]);
        });
        it('tpl', () => {
            const lexer = new Lexer();
            content = '@{var}';
            pos = 0;
            expect(lexer.analyzeSingleVar(content)).to.deep.eq([t('@{'), t('var', Tok.TYPES.name), t('}')]);
        });
        it('empty tpl', () => {
            const lexer = new Lexer();
            content = '@{}';
            pos = 0;
            expect(lexer.analyzeSingleVar(content)).to.deep.eq([t('@{'), t('', Tok.TYPES.name), t('}')]);
        });
        it('tpl var', () => {
            const lexer = new Lexer();
            content = '#{}';
            pos = 0;
            expect(lexer.analyzeSingleVar(content)).to.deep.eq([t('#{'), t('', Tok.TYPES.name), t('}')]);
        });
        it('empty tpl with white space', () => {
            const lexer = new Lexer();
            content = '@{  }';
            pos = 0;
            expect(lexer.analyzeSingleVar(content)).to.deep.eq([t('@{'), t('  ', Tok.TYPES.whiteSpace), t('', Tok.TYPES.name), t('}')]);
        });
        it('var with white space', () => {
            const lexer = new Lexer();
            content = '${ a }';
            pos = 0;
            expect(lexer.analyzeSingleVar(content)).to.deep.eq([
                t('${'),
                t(' ', Tok.TYPES.whiteSpace),
                t('a', Tok.TYPES.name),
                t(' ', Tok.TYPES.whiteSpace),
                t('}')
            ]);
        });
    });

    describe('should identify func call', () => {
        it('no parameters', () => {
            const lexer = new Lexer();
            content = '${func()}';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([t('${'), t('func', Tok.TYPES.name), t('('), t(')'), t('}')]);
        });

        it('one parameter', () => {
            const lexer = new Lexer();
            content = '${func(var)}';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([
                t('${'),
                t('func', Tok.TYPES.name),
                t('('),
                t('var', Tok.TYPES.nameWide),
                t(')'),
                t('}')
            ]);
        });

        it('empty second parameter', () => {
            const lexer = new Lexer();
            content = '${func(var,)}';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([
                t('${'),
                t('func', Tok.TYPES.name),
                t('('),
                t('var', Tok.TYPES.nameWide),
                t(','),
                t('', Tok.TYPES.nameWide),
                t(')'),
                t('}')
            ]);
        });

        it('func with leading space', () => {
            const lexer = new Lexer();
            content = '${ \tfunc()}';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([
                t('${'),
                t(' \t', Tok.TYPES.whiteSpace),
                t('func', Tok.TYPES.name),
                t('('),
                t(')'),
                t('}')
            ]);
        });

        it('parameters with space and var reference', () => {
            const lexer = new Lexer();
            content = '${func( var1, ${var2}, var3 )}';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([
                t('${'),
                t('func', Tok.TYPES.name),
                t('('),
                t(' ', Tok.TYPES.whiteSpace),
                t('var1', Tok.TYPES.nameWide),
                t(','),
                t(' ', Tok.TYPES.whiteSpace),
                t('${'),
                t('var2', Tok.TYPES.name),
                t('}'),
                t(','),
                t(' ', Tok.TYPES.whiteSpace),
                t('var3', Tok.TYPES.nameWide),
                t(' ', Tok.TYPES.whiteSpace),
                t(')'),
                t('}')
            ]);
        });

        it('template with variables and new lines', () => {
            const lexer = new Lexer();
            content = '@{ func( var1 = var1\n, \nvar2= ${var2}, var3 =1 )}';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([
                t('@{'),
                t(' ', Tok.TYPES.whiteSpace),
                t('func', Tok.TYPES.name),
                t('('),
                t(' ', Tok.TYPES.whiteSpace),
                t('var1', Tok.TYPES.name),
                t(' ', Tok.TYPES.whiteSpace),
                t('=', Tok.TYPES.assignment),
                t(' ', Tok.TYPES.whiteSpace),
                t('var1', Tok.TYPES.nameWide),
                t('\n', Tok.TYPES.whiteSpace),
                t(','),
                t(' \n', Tok.TYPES.whiteSpace),
                t('var2', Tok.TYPES.name),
                t('=', Tok.TYPES.assignment),
                t(' ', Tok.TYPES.whiteSpace),
                t('${'),
                t('var2', Tok.TYPES.name),
                t('}'),
                t(','),
                t(' ', Tok.TYPES.whiteSpace),
                t('var3', Tok.TYPES.name),
                t(' ', Tok.TYPES.whiteSpace),
                t('=', Tok.TYPES.assignment),
                t('1', Tok.TYPES.nameWide),
                t(' ', Tok.TYPES.whiteSpace),
                t(')'),
                t('}')
            ]);
        });

        it('template with empty vars and spaces', () => {
            const lexer = new Lexer();
            content = '@{f(,var4, )}';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([
                t('@{'),
                t('f', Tok.TYPES.name),
                t('('),
                t('', Tok.TYPES.name),
                t('', Tok.TYPES.assignment),
                t('', Tok.TYPES.nameWide),
                t(','),
                t('var4', Tok.TYPES.name),
                t('', Tok.TYPES.assignment),
                t('', Tok.TYPES.nameWide),
                t(','),
                t(' ', Tok.TYPES.whiteSpace),
                t('', Tok.TYPES.name),
                t('', Tok.TYPES.assignment),
                t('', Tok.TYPES.nameWide),
                t(')'),
                t('}')
            ]);
        });

        it('space in the end', () => {
            const lexer = new Lexer();
            content = '@{f() }';
            pos = 0;
            expect(lexer.analyzeSingleFuncCall(content)).to.deep.eq([
                t('@{'),
                t('f', Tok.TYPES.name),
                t('('),
                t(')'),
                t(' ', Tok.TYPES.whiteSpace),
                t('}')
            ]);
        });
    });
    describe('should identify all', () => {
        it('ignore comment', () => {
            const lexer = new Lexer();

            content = '--abc${lit}';
            pos = 0;
            expect(lexer.analyze(content, true)).to.deep.eq([
                t('--abc', Tok.TYPES.any), // in string, '--' is not comment
                t('${'),
                t('lit', Tok.TYPES.name),
                t('}')
            ]);
        });
        it('ignore comment and quotes', () => {
            const lexer = new Lexer();
            content = "ab'c${lit(a, ${b})}--";
            pos = 0;
            expect(lexer.analyze(content, true)).to.deep.eq([
                t("ab'c", Tok.TYPES.any),
                t('${'),
                t('lit', Tok.TYPES.name),
                t('('),
                t('a', Tok.TYPES.nameWide),
                t(','),
                t(' ', Tok.TYPES.whiteSpace),
                t('${'),
                t('b', Tok.TYPES.name),
                t('}'),
                t(')'),
                t('}'),
                t('--', Tok.TYPES.any) // in string, -- is not comment
            ]);
        });
        it('should ignore parsing when no identity chars found', () => {
            const lexer = new Lexer();
            content = '--abc$\\{lit(a, $\\{b})}';
            pos = 0;
            expect(lexer.analyze(content, true)).to.deep.eq([t('--abc$\\{lit(a, $\\{b})}', Tok.TYPES.any)]);
        });
        it('enable comment', () => {
            const lexer = new Lexer();
            content = '--abc${lit(a, ${b})}';
            pos = 0;
            expect(lexer.analyze(content)).to.deep.eq([t('--', Tok.TYPES.commentStart), t('abc${lit(a, ${b})}', Tok.TYPES.any)]);

            content = 'xx--abc${lit(a, ${b})}';
            pos = 0;
            expect(lexer.analyze(content)).to.deep.eq([
                t('xx', Tok.TYPES.any),
                t('--', Tok.TYPES.commentStart),
                t('abc${lit(a, ${b})}', Tok.TYPES.any)
            ]);

            content = 'xx---abc${lit(a, ${b})}';
            pos = 0;
            expect(lexer.analyze(content)).to.deep.eq([
                t('xx', Tok.TYPES.any),
                t('--', Tok.TYPES.commentStart),
                t('-abc${lit(a, ${b})}', Tok.TYPES.any)
            ]);
        });

        it.skip('should ignore parsing when identity chars disabled', () => {
            const lexer = new Lexer();
            content = '--abc$${lit(a, ${b})}';
            pos = 0;
            expect(lexer.analyze(content)).to.deep.eq([
                t('--abc${lit(a, ', Tok.TYPES.any),
                t('${'),
                t('b', Tok.TYPES.name),
                t('}'),
                t(')}', Tok.TYPES.any)
            ]);
        });
    });

    it('should identify var reference', () => {
        // expect(new SemanticAnalyzer(new Lexer()).analyze(`'abc\${lit}-+\${func(var1, \${lit}, var2)}-!\${func()}' abc\${lit}-+\${func(var1, \${lit}, var2)}-!\${func()}--\${v} \${f()}`)).to.eq([
        //     new SqlLine(
        //         new Str(new Tok('\'abc', 0)),
        //         new VarReference(new Tok('${', 3), new Var(new Tok('lit', 5)), new Tok('}', 8))
        //         new Str(new Tok('-+', 9)),
        //         new VarReference(
        //             new Tok('${', 11),
        //             new Func(
        //                 new Lit(new Tok('var1', 13)),
        //                 new VarReference(new Tok('${', 18), new Var(new Tok('lit', 20)), new Tok('}', 23)),
        //                 new Lit(new Tok('var2', 25)),
        //             ),
        //             new Tok('}', 29)
        //         )
        // ])
    });
});
