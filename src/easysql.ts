export class TokType {
    constructor(public id: number, public name: string) {}

    get isVarCurlyBracketStart() {
        return this.id === Tok.TYPES.varCurlyBracketStart.id;
    }
    get isTplCurlyBracketStart() {
        return this.id === Tok.TYPES.tplCurlyBracketStart.id;
    }
    get isTplVarCurlyBracketStart() {
        return this.id === Tok.TYPES.tplVarCurlyBracketStart.id;
    }
    get isCurlyBracketEnd() {
        return this.id === Tok.TYPES.curlyBracketEnd.id;
    }
    get isParenthesisStart() {
        return this.id === Tok.TYPES.parenthesisStart.id;
    }
    get isParenthesisEnd() {
        return this.id === Tok.TYPES.parenthesisEnd.id;
    }
    get isName() {
        return this.id === Tok.TYPES.name.id;
    }
    get isComma() {
        return this.id === Tok.TYPES.comma.id;
    }
    get isAssignment() {
        return this.id === Tok.TYPES.assignment.id;
    }
    get isNameWide() {
        return this.id === Tok.TYPES.nameWide.id;
    }
    get isCommentStart() {
        return this.id === Tok.TYPES.commentStart.id;
    }
    get isWhiteSpace() {
        return this.id === Tok.TYPES.whiteSpace.id;
    }
    get isAny() {
        return this.id === Tok.TYPES.any.id;
    }
}

export class Tok {
    static TYPES = {
        varCurlyBracketStart: new TokType(1, 'varCurlyBracketStart'),
        tplCurlyBracketStart: new TokType(2, 'tplCurlyBracketStart'),
        tplVarCurlyBracketStart: new TokType(3, 'tplVarCurlyBracketStart'),
        curlyBracketEnd: new TokType(4, 'curlyBracketEnd'),
        parenthesisStart: new TokType(5, 'parenthesisStart'),
        parenthesisEnd: new TokType(6, 'parenthesisEnd'),
        comma: new TokType(7, 'comma'),
        assignment: new TokType(8, 'assignment'),
        name: new TokType(20, 'name'),
        nameWide: new TokType(21, 'nameWide'),
        commentStart: new TokType(22, 'commentStart'),
        whiteSpace: new TokType(23, 'whiteSpace'),
        any: new TokType(24, 'any')
    };
    static typeId2Type = new Map<number, TokType>(Object.values(Tok.TYPES).map((type) => [type.id, type]));

    constructor(
        public readonly start: number,
        public readonly length: number,
        public readonly content: string,
        public readonly tokeType: TokType,
        public readonly textHint?: string
    ) {}

    get text() {
        if (this.textHint !== undefined) {
            return this.textHint;
        }
        return this.content.substring(this.start, this.start + this.length);
    }

    parentTokFrom(start: number, content: string) {
        return new Tok(this.start + start, this.length, content, this.tokeType, this.textHint);
    }
}

export class Lexer {
    analyze(content: string, ignoreComment?: boolean, ignoreFuncCall?: boolean): Tok[] {
        if (!/[\\$#]{[^}]+}/.test(content)) {
            return [new Tok(0, content.length, content, Tok.TYPES.any)];
        }
        const fullContent = content;

        let commentToks: Tok[] = [];
        let commentStartIdx = -1;
        if (!ignoreComment) {
            commentStartIdx = this.findCommentStart(content);
            if (commentStartIdx !== -1) {
                commentToks = [
                    new Tok(commentStartIdx, 2, content, Tok.TYPES.commentStart),
                    new Tok(commentStartIdx + 2, content.length - commentStartIdx - 2, content, Tok.TYPES.any)
                ];
                content = content.substring(0, commentStartIdx);
            }
        }

        if (!ignoreFuncCall) {
            const funcCallMatches = Array.from(content.matchAll(/[$@]{\s*[\w]+\([^)]*\)}/g));
            if (funcCallMatches.length) {
                if (funcCallMatches.length === 1 && funcCallMatches[0][0] === content) {
                    return this.analyzeSingleFuncCall(content).map((tok) => tok.parentTokFrom(0, fullContent));
                }
                let toks: Tok[] = [];
                funcCallMatches.forEach((funcCallMatch, i) => {
                    if (i === 0 && funcCallMatch.index !== 0) {
                        toks = toks.concat(this.analyze(content.substring(0, funcCallMatch.index), true, true));
                    }
                    toks = toks.concat(
                        this.analyzeSingleFuncCall(funcCallMatch[0]).map((tok) => tok.parentTokFrom(funcCallMatch.index!, fullContent))
                    );
                    if (i === funcCallMatches.length - 1) {
                        toks = toks.concat(
                            this.analyze(content.substring(funcCallMatch.index! + funcCallMatch[0].length, content.length), true, true).map((tok) =>
                                tok.parentTokFrom(funcCallMatch[0].length + funcCallMatch.index!, fullContent)
                            )
                        );
                    }
                });

                return toks.map((tok) => tok.parentTokFrom(0, fullContent)).concat(commentToks);
            }
        }

        const varMatches = Array.from(content.matchAll(/[$@#]{[\w]+}/g));
        if (varMatches.length) {
            if (varMatches.length === 1 && varMatches[0][0] === content) {
                return this.analyzeSingleVar(content).map((tok) => tok.parentTokFrom(0, fullContent));
            }
            let toks: Tok[] = [];
            varMatches.forEach((varMatch, i) => {
                if (i === 0 && varMatch.index !== 0) {
                    toks.push(new Tok(0, varMatch.index!, fullContent, Tok.TYPES.any));
                }
                toks = toks.concat(this.analyzeSingleVar(varMatch[0]).map((tok) => tok.parentTokFrom(varMatch.index!, fullContent)));
                if (i === varMatches.length - 1 && content.length - varMatch.index! - varMatch[0].length > 0) {
                    toks.push(
                        new Tok(
                            varMatch.index! + varMatch[0].length,
                            content.length - varMatch.index! - varMatch[0].length,
                            fullContent,
                            Tok.TYPES.any
                        )
                    );
                }
            });
            return toks.map((tok) => tok.parentTokFrom(0, fullContent)).concat(commentToks);
        }

        const toks = [];
        if (content) {
            toks.push(new Tok(0, content.length, fullContent, Tok.TYPES.any));
        }

        return commentToks ? toks.concat(commentToks) : toks;
    }

    public findCommentStart(content: string): number {
        const quoteChars = '\'"`';
        let quoteOpen = '';
        let hasLeadingBackslash = false;
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            if (ch === '\\') {
                hasLeadingBackslash = !hasLeadingBackslash;
                continue;
            }
            if (quoteChars.includes(ch)) {
                if (quoteOpen === ch && !hasLeadingBackslash) {
                    quoteOpen = '';
                } else if (!quoteOpen && !hasLeadingBackslash) {
                    quoteOpen = ch;
                }
                hasLeadingBackslash = false;
            } else if (ch === '-' && content.charAt(i + 1) === '-' && !quoteOpen) {
                return i;
            }
        }
        return -1;
    }

    public analyzeSingleFuncCall(content: string): Tok[] {
        // e.g. ${func(var1, ${var2}, var3)}, @{func(a=var1, b=${var2})}, ${func()}, @{func()}
        const tokType = content[0] === '$' ? Tok.TYPES.varCurlyBracketStart : Tok.TYPES.tplCurlyBracketStart;
        const startTok = new Tok(0, 2, content, tokType);
        const parenthesisEndIdx = content.lastIndexOf(')');
        if (parenthesisEndIdx === -1) {
            throw new Error('Should contain right parenthesis, found nothing!');
        }

        // handle: func(
        let contentStart = 2;
        const funcCallContent = content.substring(contentStart, content.length - contentStart);
        const toks: Tok[] = [startTok];

        const parenthesisStart = funcCallContent.indexOf('(');
        if (parenthesisStart === -1) {
            throw new Error('Must have parenthesis start, found nothing');
        }
        const funcName = funcCallContent.substring(0, parenthesisStart + 1);
        const matches = funcName.match(/^(\s*)([^\s]+)\($/);
        if (!matches) {
            throw new Error('Must have a match, found nothing');
        }
        if (matches[1]) {
            toks.push(new Tok(contentStart, matches[1].length, content, Tok.TYPES.whiteSpace));
        }
        toks.push(new Tok(contentStart + matches[1].length, matches[2].length, content, Tok.TYPES.name));
        toks.push(new Tok(contentStart + parenthesisStart, 1, content, Tok.TYPES.parenthesisStart));

        contentStart = contentStart + parenthesisStart + 1;
        const paramsContent = content.substring(contentStart, parenthesisEndIdx);
        let paramStart = 0;
        const splits = paramsContent.split(',');

        // handle params
        splits.forEach((paramContent, i) => {
            if (splits.length === 1) {
                if (/^\s+$/.test(paramContent)) {
                    toks.push(new Tok(contentStart + paramStart, paramContent.length, content, Tok.TYPES.whiteSpace));
                    return;
                } else if (!paramContent) {
                    return;
                }
            }

            if (tokType === Tok.TYPES.varCurlyBracketStart) {
                // handle parameters: var1, ${var2}, var3
                this.parseNameWithWhiteSpace(paramContent, Tok.TYPES.nameWide, true).forEach((tok) =>
                    toks.push(tok.parentTokFrom(contentStart + paramStart, content))
                );
            } else if (tokType === Tok.TYPES.tplCurlyBracketStart) {
                // handle parameters: var1=var1, var2=${var2}, var3=
                const assignmentIdx = paramContent.indexOf('=');
                if (assignmentIdx === -1) {
                    this.parseNameWithWhiteSpace(paramContent, Tok.TYPES.name).forEach((tok) =>
                        toks.push(tok.parentTokFrom(contentStart + paramStart, content))
                    );
                    toks.push(new Tok(contentStart + paramStart + paramContent.length, 0, content, Tok.TYPES.assignment));
                    toks.push(new Tok(contentStart + paramStart + paramContent.length, 0, content, Tok.TYPES.nameWide));
                } else {
                    this.parseNameWithWhiteSpace(paramContent.substring(0, assignmentIdx), Tok.TYPES.name).forEach((tok) =>
                        toks.push(tok.parentTokFrom(contentStart + paramStart, content))
                    );
                    toks.push(new Tok(contentStart + paramStart + assignmentIdx, 1, content, Tok.TYPES.assignment));
                    this.parseNameWithWhiteSpace(paramContent.substring(assignmentIdx + 1), Tok.TYPES.nameWide, true).forEach((tok) =>
                        toks.push(tok.parentTokFrom(contentStart + paramStart + assignmentIdx + 1, content))
                    );
                }
            } else {
                throw new Error('unsupported token type: ' + tokType.name);
            }

            if (i !== splits.length - 1) {
                toks.push(new Tok(contentStart + paramStart + paramContent.length, 1, content, Tok.TYPES.comma));
            }
            paramStart += paramContent.length + 1;
        });

        // handle: )}, ) }
        const endToks = [new Tok(parenthesisEndIdx, 1, content, Tok.TYPES.parenthesisEnd)];
        if (parenthesisEndIdx !== content.length - 2) {
            endToks.push(new Tok(parenthesisEndIdx + 1, content.length - parenthesisEndIdx - 2, content, Tok.TYPES.whiteSpace));
        }
        endToks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));

        return toks.concat(endToks);
    }

    private parseNameWithWhiteSpace(content: string, tokType: TokType, parseVarReference?: boolean) {
        const toks: Tok[] = [];
        const leftTrimed = content.trimStart();
        const leftSpaceLength = content.length - leftTrimed.length;
        if (leftSpaceLength > 0) {
            toks.push(new Tok(0, leftSpaceLength, content, Tok.TYPES.whiteSpace));
        }

        const rightTrimed = leftTrimed.trimEnd();
        if (parseVarReference && /^\${.*}$/.test(rightTrimed)) {
            this.analyzeSingleVar(rightTrimed).forEach((tok) => toks.push(tok.parentTokFrom(leftSpaceLength, content)));
        } else {
            toks.push(new Tok(leftSpaceLength, rightTrimed.length, content, tokType));
        }

        const rightSpaceLength = leftTrimed.length - rightTrimed.length;
        if (rightSpaceLength > 0) {
            toks.push(new Tok(content.length - rightSpaceLength, rightSpaceLength, content, Tok.TYPES.whiteSpace));
        }
        return toks;
    }

    public analyzeSingleVar(content: string): Tok[] {
        // e.g. ${var2}  @{ var2 }
        const tokType =
            content[0] === '$'
                ? Tok.TYPES.varCurlyBracketStart
                : content[0] === '@'
                ? Tok.TYPES.tplCurlyBracketStart
                : Tok.TYPES.tplVarCurlyBracketStart;
        const toks = [new Tok(0, 2, content, tokType)];

        const nameContent = content.substring(2, content.length - 1);
        const matches = nameContent.match(/^(\s*)([^\s]*)(\s*)$/);
        if (!matches) {
            throw new Error('Must have a match, found nothing');
        }
        const start = 2;
        if (matches[1]) {
            toks.push(new Tok(start, matches[1].length, content, Tok.TYPES.whiteSpace));
        }
        toks.push(new Tok(start + matches[1].length, matches[2].length, content, Tok.TYPES.name));
        if (matches[3]) {
            toks.push(new Tok(start + matches[1].length + matches[2].length, matches[3].length, content, Tok.TYPES.whiteSpace));
        }

        toks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));
        return toks;
    }
}

export class SemanticAnalyzer {}
