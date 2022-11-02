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
        quote: new TokType(9, 'quote'),
        name: new TokType(20, 'name'),
        nameWide: new TokType(21, 'nameWide'),
        commentStart: new TokType(22, 'commentStart'),
        whiteSpace: new TokType(23, 'whiteSpace'),
        any: new TokType(24, 'any')
    };
    static typeId2Type = new Map<number, TokType>(Object.values(Tok.TYPES).map((type) => [type.id, type]));

    constructor(
        public start: number,
        public length: number,
        public content: string,
        public readonly tokeType: TokType,
        public readonly textHint?: string
    ) {}

    get end() {
        return this.start + this.length;
    }

    get text() {
        if (this.textHint !== undefined) {
            return this.textHint;
        }
        return this.content.substring(this.start, this.start + this.length);
    }

    get isValid() {
        if (this.tokeType.isAssignment) {
            return this.text === '=';
        }
        if (this.tokeType.isName) {
            return /^[a-zA-Z_]\w*$/.test(this.text);
        }
        if (this.tokeType.isNameWide) {
            return /^[^,()$\n'"`]*$/.test(this.text);
        }
        return true;
    }

    addCharOfLength(charLength: number) {
        if (charLength < 0) {
            this.start += charLength; // add to head
            this.length += -charLength;
        } else {
            this.length += charLength; // add to end
        }
    }

    resetParentTokFrom(start: number, content: string) {
        this.start = this.start + start;
        this.content = content;
    }

    parentTokFrom(start: number, content: string) {
        return new Tok(this.start + start, this.length, content, this.tokeType, this.textHint);
    }
}

class SinlgeFuncCallParser {
    parse(content: string): VarFuncCall | TplFuncCall {
        // e.g. ${func(var1, ${var2}, var3)}, @{func(a=var1, b=${var2})}, ${func()}, @{func()}
        const tokType = content[0] === '$' ? Tok.TYPES.varCurlyBracketStart : Tok.TYPES.tplCurlyBracketStart;
        const startNode = new Sentinel([new Tok(0, 2, content, tokType)]);

        // handle: func(
        let contentStart = 2;
        const funcCallContent = content.substring(contentStart, content.length - contentStart);
        const parenthesisStart = funcCallContent.indexOf('(');
        if (parenthesisStart === -1) {
            throw new Error('Must have parenthesis start, found nothing');
        }
        const [sentinelNode, funcNameNode, argStart] = this.parseFuncStartNodes(funcCallContent, parenthesisStart).map((node) =>
            node.resetTokFrom(contentStart, content)
        ) as [Sentinel, Name, Sentinel];
        startNode.merge(sentinelNode);

        // handle params
        contentStart = contentStart + parenthesisStart + 1;
        const parenthesisEndIdx = content.lastIndexOf(')');
        if (parenthesisEndIdx === -1) {
            throw new Error('Should contain right parenthesis, found nothing!');
        }
        const paramsContent = content.substring(contentStart, parenthesisEndIdx);
        const paramsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = this.parseParams(paramsContent, contentStart, content, tokType);

        // handle end: )}, ) }
        const endNode = this.parseEndNode(parenthesisEndIdx, content);

        return tokType.isVarCurlyBracketStart
            ? new VarFuncCall(startNode, funcNameNode, argStart, paramsNode as (Sentinel | Lit | VarReference)[], endNode)
            : new TplFuncCall(startNode, funcNameNode, argStart, paramsNode as (Sentinel | TplFuncArg)[], endNode);
    }

    private parseEndNode(parenthesisEndIdx: number, content: string) {
        const endToks = [new Tok(parenthesisEndIdx, 1, content, Tok.TYPES.parenthesisEnd)];
        if (parenthesisEndIdx !== content.length - 2) {
            endToks.push(new Tok(parenthesisEndIdx + 1, content.length - parenthesisEndIdx - 2, content, Tok.TYPES.whiteSpace));
        }
        endToks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));
        const endNode = new Sentinel(endToks);
        return endNode;
    }

    private parseFuncStartNodes(funcCallContent: string, parenthesisStart: number): [Sentinel, Name, Sentinel] {
        const funcName = funcCallContent.substring(0, parenthesisStart + 1);
        const matches = funcName.match(/^(\s*)([^\s]+)\($/);
        if (!matches) {
            throw new Error('Must have a match, found nothing: ' + funcCallContent);
        }

        const sentinelToks = [];
        if (matches[1]) {
            sentinelToks.push(new Tok(0, matches[1].length, funcCallContent, Tok.TYPES.whiteSpace));
        }

        const sentinelNode = new Sentinel(sentinelToks);
        const funcNameNode = new Name(new Tok(matches[1].length, matches[2].length, funcCallContent, Tok.TYPES.name));
        const argStart = new Sentinel([new Tok(parenthesisStart, 1, funcCallContent, Tok.TYPES.parenthesisStart)]);
        return [sentinelNode, funcNameNode, argStart];
    }

    private parseParams(paramsContent: string, contentStart: number, content: string, tokType: TokType) {
        let paramStart = 0;
        const splits = paramsContent.split(',');
        const paramsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = [];

        splits.forEach((paramContent, i) => {
            if (splits.length === 1) {
                if (/^\s+$/.test(paramContent)) {
                    paramsNode.push(new Sentinel([new Tok(contentStart + paramStart, paramContent.length, content, Tok.TYPES.whiteSpace)]));
                    return;
                } else if (!paramContent) {
                    return;
                }
            }

            if (tokType === Tok.TYPES.varCurlyBracketStart) {
                // handle parameters: var1 | ${var2} | var3
                this.parseNameWithWhiteSpace(paramContent, Tok.TYPES.nameWide, true).forEach((node) =>
                    paramsNode.push(node.resetTokFrom(contentStart + paramStart, content))
                );
            } else if (tokType === Tok.TYPES.tplCurlyBracketStart) {
                // handle parameters: var1=var1, var2=${var2}, var3=
                const assignmentIdx = paramContent.indexOf('=');
                if (assignmentIdx === -1) {
                    const tplFuncVar = this.parseTplFuncVarWithNoAssignment(paramContent).resetTokFrom(contentStart + paramStart, content);
                    paramsNode.push(tplFuncVar);
                } else {
                    const tplFuncVar = this.parseTplFuncVar(paramContent, assignmentIdx, contentStart, paramStart, content);
                    paramsNode.push(tplFuncVar);
                }
            } else {
                throw new Error('unsupported token type: ' + tokType.name);
            }

            if (i !== splits.length - 1) {
                paramsNode.push(new Sentinel([new Tok(contentStart + paramStart + paramContent.length, 1, content, Tok.TYPES.comma)]));
            }
            paramStart += paramContent.length + 1;
        });

        // squeeze sentinel nodes in parameter nodes
        const squeezedParamsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = this.squeezeSentinelNodes(paramsNode);

        return squeezedParamsNode;
    }

    private parseTplFuncVar(paramContent: string, assignmentIdx: number, contentStart: number, paramStart: number, content: string) {
        const argName: [Sentinel, Lit, Sentinel] = this.parseNameWithWhiteSpace(paramContent.substring(0, assignmentIdx), Tok.TYPES.name).map(
            (node) => node.resetTokFrom(contentStart + paramStart, content)
        ) as [Sentinel, Lit, Sentinel];
        const assignment = new Sentinel([new Tok(contentStart + paramStart + assignmentIdx, 1, content, Tok.TYPES.assignment)]);
        const value: [Sentinel, Lit | VarReference, Sentinel] = this.parseNameWithWhiteSpace(
            paramContent.substring(assignmentIdx + 1),
            Tok.TYPES.nameWide,
            true
        ).map((node) => node.resetTokFrom(contentStart + paramStart + assignmentIdx + 1, content)) as [Sentinel, Lit | VarReference, Sentinel];
        const tplFuncVar = new TplFuncArg(argName[0], argName[1].asName(), argName[2].merge(assignment).merge(value[0]), value[1], value[2]);
        return tplFuncVar;
    }

    private parseTplFuncVarWithNoAssignment(paramContent: string) {
        const argName: [Sentinel, Lit, Sentinel] = this.parseNameWithWhiteSpace(paramContent, Tok.TYPES.name) as [Sentinel, Lit, Sentinel];
        const assignment = new Sentinel([new Tok(paramContent.length, 0, paramContent, Tok.TYPES.assignment)]);
        const value = new Lit(new Tok(paramContent.length, 0, paramContent, Tok.TYPES.nameWide));
        const tplFuncVar = new TplFuncArg(argName[0], argName[1].asName(), argName[2].merge(assignment), value, new Sentinel([]));
        return tplFuncVar;
    }

    private squeezeSentinelNodes(paramsNode: (VarReference | Sentinel | Lit | TplFuncArg)[]) {
        const squeezedParamsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = [];
        paramsNode.forEach((node) => {
            if (node instanceof Sentinel) {
                if (!node.isEmpty) {
                    const lastNode = squeezedParamsNode[squeezedParamsNode.length - 1];
                    if (lastNode && lastNode instanceof Sentinel) {
                        lastNode.merge(node);
                    } else {
                        squeezedParamsNode.push(node);
                    }
                }
            } else {
                squeezedParamsNode.push(node);
            }
        });
        return squeezedParamsNode;
    }

    private parseNameWithWhiteSpace(content: string, tokType: TokType, parseVarReference?: boolean): [Sentinel, Lit | VarReference, Sentinel] {
        const leftTrimed = content.trimStart();
        const leftSpaceLength = content.length - leftTrimed.length;
        const startNode = new Sentinel(leftSpaceLength > 0 ? [new Tok(0, leftSpaceLength, content, Tok.TYPES.whiteSpace)] : []);

        let valueNode: Lit | VarReference;
        const rightTrimed = leftTrimed.trimEnd();
        if (parseVarReference && /^\${.*}$/.test(rightTrimed)) {
            valueNode = new SingleVarParser().parse(rightTrimed).resetTokFrom(leftSpaceLength, content) as VarReference;
        } else {
            valueNode = new Lit(new Tok(leftSpaceLength, rightTrimed.length, content, tokType));
        }

        const rightSpaceLength = leftTrimed.length - rightTrimed.length;
        const endNode = new Sentinel(
            rightSpaceLength > 0 ? [new Tok(content.length - rightSpaceLength, rightSpaceLength, content, Tok.TYPES.whiteSpace)] : []
        );

        return [startNode, valueNode, endNode];
    }
}

class SingleVarParser {
    parse(content: string) {
        // e.g. ${var2}  @{ var2 }
        const tokType =
            content[0] === '$'
                ? Tok.TYPES.varCurlyBracketStart
                : content[0] === '@'
                ? Tok.TYPES.tplCurlyBracketStart
                : Tok.TYPES.tplVarCurlyBracketStart;

        // start node
        const startToks = [new Tok(0, 2, content, tokType)];
        const nameContent = content.substring(2, content.length - 1);
        const startMatches = nameContent.match(/^(\s*)/);
        if (!startMatches) {
            throw new Error('Must have a match, found nothing');
        }
        const start = 2;
        if (startMatches[1]) {
            startToks.push(new Tok(start, startMatches[1].length, content, Tok.TYPES.whiteSpace));
        }
        const startNode = new Sentinel(startToks);

        const endMatches = nameContent.match(/(\s*)$/);
        if (!endMatches) {
            throw new Error('Must have a match, found nothing');
        }

        // var name node
        const varTok = new Tok(
            start + startMatches[1].length,
            nameContent.length - startMatches[1].length - endMatches[1].length,
            content,
            Tok.TYPES.name
        );
        const varName = new Name(varTok);

        // end node
        const endToks: Tok[] = [];
        if (endMatches[1]) {
            endToks.push(new Tok(start + endMatches.index!, endMatches[1].length, content, Tok.TYPES.whiteSpace));
        }
        endToks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));
        const endNode = new Sentinel(endToks);

        return tokType.isVarCurlyBracketStart
            ? new VarReference(startNode, varName, endNode)
            : tokType.isTplCurlyBracketStart
            ? new TplReference(startNode, varName, endNode)
            : new TplVarReference(startNode, varName, endNode);
    }
}

let i = 0;
export class Parser {
    parse(content: string, ignoreComment?: boolean, ignoreQuote?: boolean): EasySqlNode[] {
        i += 1;
        if (i > 50) {
            // throw new Error('stuck overflow');
        }
        console.log(`parsing content: ${content}, ignoreComment=${ignoreComment}, ignoreQuote=${ignoreQuote}`);
        if (ignoreQuote && !ignoreComment) {
            throw new Error("If quote is ignored, comment must be ignored. Since we don't need to find comments inside a string!");
        }

        let commentStartIdx = -1;
        if (!ignoreComment) {
            commentStartIdx = this.findCommentStartInCurrentLine(content);
            if (commentStartIdx !== -1) {
                return this.parseContentWithCommentInCurrentLine(content, commentStartIdx);
            }
        }

        if (!ignoreQuote) {
            const openQuoteIdx = this.findOpenQuoteInCurrentLine(content);
            if (openQuoteIdx !== -1) {
                return this.parseContentWithOpenQuoteInCurrentLine(content, openQuoteIdx);
            }
        }

        let nodes: EasySqlNode[] = [];
        let tplCallMatch = content.match(/@{(\n|[^'"`(}])+\((\n|[^'"`)])*\)(\n|\s)*}/);
        let funcCallMatch = content.match(/\${([^'"`(}])+\(([^'"`)])*\)(\s)*}/);
        let varMatch = content.match(/[$@#]{[^}]*}/);
        let quoteMatch = ignoreQuote ? null : content.match(/(['"`])/);
        const nextLineBreakIdx = content.indexOf('\n');
        if (nextLineBreakIdx !== -1) {
            if (tplCallMatch && tplCallMatch.index! > nextLineBreakIdx) {
                tplCallMatch = null;
            }
            if (funcCallMatch && funcCallMatch.index! > nextLineBreakIdx) {
                funcCallMatch = null;
            }
            if (varMatch && varMatch.index! > nextLineBreakIdx) {
                varMatch = null;
            }
            if (quoteMatch && quoteMatch.index! > nextLineBreakIdx) {
                quoteMatch = null;
            }
        }

        const firstMatch = this.findFirstMatch([tplCallMatch, funcCallMatch, varMatch, quoteMatch]);
        if (firstMatch) {
            if (firstMatch.index! !== 0) {
                nodes.push(new Any(new Tok(0, firstMatch.index!, content, Tok.TYPES.any)));
            }
            let nextStartIndex = firstMatch.index! + firstMatch[0].length;
            if (firstMatch === varMatch) {
                nodes.push(this.parseSingleVar(firstMatch[0]).resetTokFrom(firstMatch.index!, content));
            } else if (firstMatch !== quoteMatch) {
                nodes.push(this.parseSingleFuncCall(firstMatch[0]).resetTokFrom(firstMatch.index!, content));
            } else {
                const [nodesFromStr, strEndIdx] = this.parseStr(quoteMatch, content);
                nextStartIndex = strEndIdx + 1;
                nodes = nodes.concat(nodesFromStr);
            }
            this.parse(content.substring(nextStartIndex), ignoreComment, ignoreQuote).forEach((node) =>
                nodes.push(node.resetTokFrom(nextStartIndex, content))
            );
            return nodes;
        }

        if (content) {
            const nextLineBreakIdx = content.indexOf('\n');
            if (nextLineBreakIdx !== -1) {
                const nodes: EasySqlNode[] = [
                    new Any(new Tok(0, nextLineBreakIdx === -1 ? content.length : nextLineBreakIdx + 1, content, Tok.TYPES.any))
                ];
                return nodes.concat(
                    this.parse(content.substring(nextLineBreakIdx + 1)).map((node) => node.resetTokFrom(nextLineBreakIdx + 1, content))
                );
            }
            return [new Any(new Tok(0, content.length, content, Tok.TYPES.any)) as EasySqlNode];
        }

        return [];
    }

    private parseContentWithOpenQuoteInCurrentLine(content: string, openQuoteIdx: number) {
        let nodes: EasySqlNode[] = [];
        nodes = nodes.concat(this.parse(content.substring(0, openQuoteIdx), true).map((node) => node.resetTokFrom(0, content)));

        const nextLineBreakIdx = content.indexOf('\n');
        const openStrLength = nextLineBreakIdx === -1 ? content.length - openQuoteIdx : nextLineBreakIdx - openQuoteIdx;
        nodes.push(new Str(new Tok(openQuoteIdx, openStrLength, content, Tok.TYPES.any)));

        if (nextLineBreakIdx !== -1) {
            nodes.push(new Any(new Tok(nextLineBreakIdx, 1, content, Tok.TYPES.any)));
            this.parse(content.substring(nextLineBreakIdx + 1)).forEach((node) => nodes.push(node.resetTokFrom(nextLineBreakIdx + 1, content)));
        }
        return nodes;
    }

    private parseContentWithCommentInCurrentLine(content: string, commentStartIdx: number) {
        let nodes: EasySqlNode[] = [];

        const nextLineBreakIdx = content.indexOf('\n');
        nodes = nodes.concat(this.parse(content.substring(0, commentStartIdx), true).map((node) => node.resetTokFrom(0, content)));
        nodes.push(
            new Comment(
                new Sentinel([new Tok(commentStartIdx, 2, content, Tok.TYPES.commentStart)]),
                new Tok(
                    commentStartIdx + 2,
                    (nextLineBreakIdx === -1 ? content.length : nextLineBreakIdx) - commentStartIdx - 2,
                    content,
                    Tok.TYPES.any
                )
            )
        );

        if (nextLineBreakIdx !== -1) {
            nodes.push(new Any(new Tok(nextLineBreakIdx, 1, content, Tok.TYPES.any)));
            this.parse(content.substring(nextLineBreakIdx + 1)).forEach((node) => nodes.push(node.resetTokFrom(nextLineBreakIdx + 1, content)));
        }
        return nodes;
    }

    private parseStr(quoteMatch: RegExpMatchArray, content: string): [EasySqlNode[], number] {
        let nodesFromStr: EasySqlNode[] = [];
        const quoteStartIdx = quoteMatch.index!;
        const quoteEndIdx = content.indexOf(quoteMatch[0], quoteStartIdx + 1);
        if (!quoteEndIdx) {
            throw new Error('No quote end found, this should not happen! Current line: ' + content.substring(0, quoteEndIdx + 1));
        }

        const stringContent = content.substring(quoteStartIdx + 1, quoteEndIdx);
        if (stringContent.includes('\n')) {
            throw new Error('No line break should be included in string. This should not happen! Current string: ' + stringContent);
        }

        console.log('parsing string: ', stringContent);
        const nodesInStr = this.parse(stringContent, true, true).map((node) => node.resetTokFrom(quoteStartIdx + 1, content));

        // change first any and add starting quote to str
        if (nodesInStr.length && nodesInStr[0] instanceof Any) {
            nodesFromStr.push(nodesInStr[0].addCharOfLength(-1).asStr()); // include starting quote
            nodesInStr.splice(0, 1);
        } else {
            nodesFromStr.push(new Str(new Tok(quoteStartIdx, 1, content, Tok.TYPES.quote)));
        }
        if (nodesInStr.length && nodesInStr[0] instanceof Any) {
            throw new Error('Should not contain Any node at the top. Found: ' + nodesInStr[0].join());
        }

        // add nodes, and change last any and add ending quote to str
        if (nodesInStr.length && nodesInStr[nodesInStr.length - 1] instanceof Any) {
            nodesFromStr = nodesFromStr.concat(nodesInStr.slice(0, nodesInStr.length - 1).map((node) => (node instanceof Any ? node.asStr() : node)));
            nodesFromStr.push((nodesInStr[nodesInStr.length - 1] as Any).addCharOfLength(1).asStr()); // include end quote
        } else {
            nodesFromStr = nodesFromStr.concat(nodesInStr.map((node) => (node instanceof Any ? node.asStr() : node)));
            nodesFromStr.push(new Str(new Tok(quoteEndIdx, 1, content, Tok.TYPES.quote)));
        }

        if (nodesFromStr.length === 2) {
            // only start and end, merge them into one
            const [start, end] = [nodesFromStr[0] as Str, nodesFromStr[1] as Str];
            nodesFromStr = [new Str(new Tok(start.text.start, start.text.length + end.text.length, start.text.content, Tok.TYPES.any))];
        }

        return [nodesFromStr, quoteEndIdx];
    }

    public findFirstMatch([tplCallMatch, funcCallMatch, varMatch, quoteMatch]: (RegExpMatchArray | null)[]): RegExpMatchArray | null {
        const matches = [
            { priorityOnEq: -1, match: tplCallMatch }, // will never conflict with the other three
            { priorityOnEq: 1, match: funcCallMatch },
            { priorityOnEq: 2, match: varMatch },
            { priorityOnEq: -1, match: quoteMatch } // will never conflict with the other three
        ].filter((m) => !!m.match);
        matches.sort((a, b) => {
            if (a.match!.index! === b.match!.index!) {
                return a.priorityOnEq - b.priorityOnEq;
            }
            return a.match!.index! - b.match!.index!;
        });
        if (!matches.length) {
            return null;
        }
        return matches[0].match;
    }

    public findCommentStartInCurrentLine(content: string): number {
        // backslash is backslash in sql, it's not used to escape characters.
        // If we need to insert a quote inside string, just use double quotes. e.g. '''' is for single quote in string.
        const quoteChars = '\'"`';
        let quoteOpen = '';
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            if (ch === '\n') {
                return -1;
            }
            if (quoteChars.includes(ch)) {
                if (quoteOpen === ch) {
                    quoteOpen = '';
                } else if (!quoteOpen) {
                    quoteOpen = ch;
                }
            } else if (ch === '-' && content.charAt(i + 1) === '-' && !quoteOpen) {
                return i;
            }
        }
        return -1;
    }

    public findOpenQuoteInCurrentLine(content: string): number {
        // backslash is backslash in sql, it's not used to escape characters.
        // If we need to insert a quote inside string, just use double quotes. e.g. '''' is for single quote in string.
        const quoteChars = '\'"`';
        let quoteOpen = '';
        let quoteOpenIdx = -1;
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            if (ch === '\n') {
                return quoteOpenIdx;
            }
            if (quoteChars.includes(ch)) {
                if (quoteOpen === ch) {
                    quoteOpen = '';
                    quoteOpenIdx = -1;
                } else if (!quoteOpen) {
                    quoteOpen = ch;
                    quoteOpenIdx = i;
                }
            }
        }
        return quoteOpenIdx;
    }

    public parseSingleFuncCall(content: string): VarFuncCall | TplFuncCall {
        return new SinlgeFuncCallParser().parse(content);
    }

    public parseSingleVar(content: string): VarReference | TplReference | TplVarReference {
        return new SingleVarParser().parse(content);
    }
}

export abstract class EasySqlNode {
    abstract getChildren(): EasySqlNode[];
    abstract getToks(): Tok[];

    resetTokFrom(start: number, content: string) {
        this.getToks().forEach((tok) => tok.resetParentTokFrom(start, content));
        return this;
    }

    get startPos(): number {
        if ((this as any).start) {
            return (this as any).start.startPos;
        }
        const start = this.getToks()[0]?.start;
        return start === undefined ? -1 : start;
    }

    get endPos(): number {
        if ((this as any).end) {
            return (this as any).end.endPos;
        }
        const toks = this.getToks();
        const end = toks[toks.length - 1]?.end;
        return end === undefined ? -1 : end;
    }

    join(): string {
        const toks = this.getToks();
        if (!toks.length) {
            return '';
        }
        return toks[0].content.substring(toks[0].start, toks[toks.length - 1].end);
    }
}

export class SqlLine {
    constructor(public nodes: EasySqlNode[]) {}
}

export class Any extends EasySqlNode {
    constructor(public tok: Tok) {
        super();
    }
    getToks() {
        return [this.tok];
    }
    getChildren() {
        return [];
    }
    asStr(): Str {
        return new Str(this.tok);
    }
    addCharOfLength(charLength: number) {
        if (!this.tok) {
            throw new Error('no tok found to add chars');
        }
        this.tok.addCharOfLength(charLength);
        return this;
    }
}

export class Sentinel extends EasySqlNode {
    constructor(public toks: Tok[]) {
        super();
    }

    get isEmpty() {
        return this.toks.length === 0;
    }

    merge(node: Sentinel) {
        node.getToks().forEach((tok) => this.toks.push(tok));
        return this;
    }

    getToks() {
        return this.toks;
    }
    getChildren() {
        return [];
    }
}

export class Lit extends EasySqlNode {
    public readonly value: string;
    constructor(public tok: Tok) {
        super();
        this.value = tok.text;
    }
    getToks() {
        return [this.tok];
    }
    getChildren() {
        return [];
    }
    asName(): Name {
        return new Name(this.tok);
    }
}

export class Name extends EasySqlNode {
    public readonly name: string;
    constructor(public tok: Tok) {
        super();
        this.name = tok.text;
    }
    getToks() {
        return [this.tok];
    }
    getChildren() {
        return [];
    }
}
export class VarReference extends EasySqlNode {
    constructor(public start: Sentinel, public var_: Name, public end: Sentinel) {
        super();
    }

    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isVarCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }

    getToks() {
        return this.start.getToks().concat(this.var_.getToks()).concat(this.end.getToks());
    }

    getChildren() {
        return [this.var_];
    }

    get varTok() {
        return this.var_.tok;
    }
}

export class VarFuncCall extends EasySqlNode {
    constructor(
        public start: Sentinel,
        public funcName: Name,
        public argStart: Sentinel,
        public args: (Lit | VarReference | Sentinel)[],
        public end: Sentinel
    ) {
        super();
    }
    getToks() {
        return this.start
            .getToks()
            .concat(this.funcName.getToks())
            .concat(this.argStart.getToks())
            .concat(this.args.flatMap((node) => node.getToks()))
            .concat(this.end.getToks());
    }
    getChildren() {
        return [this.funcName, ...this.args.filter((node) => !(node instanceof Sentinel))];
    }

    get argStartTok() {
        return this.argStart.getToks().find((tok) => tok.tokeType.isParenthesisStart)!;
    }

    get argEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isParenthesisEnd)!;
    }
    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isVarCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }
}

export class TplReference extends EasySqlNode {
    constructor(public start: Sentinel, public tpl: Name, public end: Sentinel) {
        super();
    }
    getToks() {
        return this.start.getToks().concat(this.tpl.getToks()).concat(this.end.getToks());
    }
    getChildren() {
        return [this.tpl];
    }

    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isTplCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }

    get varTok() {
        return this.tpl.tok;
    }
}

export class TplVarReference extends EasySqlNode {
    constructor(public start: Sentinel, public var_: Name, public end: Sentinel) {
        super();
    }
    getToks() {
        return this.start.getToks().concat(this.var_.getToks()).concat(this.end.getToks());
    }
    getChildren() {
        return [this.var_];
    }

    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isTplVarCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }

    get varTok() {
        return this.var_.tok;
    }
}

export class TplFuncArg extends EasySqlNode {
    constructor(public start: Sentinel, public name: Name, public assignment: Sentinel, public value: Lit | VarReference, public end: Sentinel) {
        super();
    }
    getToks() {
        return this.start
            .getToks()
            .concat(this.name.getToks())
            .concat(this.assignment.getToks())
            .concat(this.value.getToks())
            .concat(this.end.getToks());
    }

    get assignmentTok() {
        return this.assignment.getToks().find((tok) => tok.tokeType.isAssignment)!;
    }

    getChildren() {
        return [this.name];
    }
}

export class TplFuncCall extends EasySqlNode {
    constructor(
        public start: Sentinel,
        public funcName: Name,
        public argStart: Sentinel,
        public args: (TplFuncArg | Sentinel)[],
        public end: Sentinel
    ) {
        super();
    }
    getToks() {
        return this.start
            .getToks()
            .concat(this.funcName.getToks())
            .concat(this.argStart.getToks())
            .concat(this.args.flatMap((node) => node.getToks()))
            .concat(this.end.getToks());
    }
    getChildren() {
        return [this.funcName, ...this.args.filter((node) => !(node instanceof Sentinel))];
    }
    get argStartTok() {
        return this.argStart.getToks().find((tok) => tok.tokeType.isParenthesisStart)!;
    }

    get argEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isParenthesisEnd)!;
    }
    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isTplCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }
}

export class Comment extends EasySqlNode {
    constructor(public start: Sentinel, public text: Tok) {
        super();
    }

    getToks() {
        return this.start.getToks().concat([this.text]);
    }

    getChildren(): EasySqlNode[] {
        return [];
    }
}

export class Str extends EasySqlNode {
    constructor(public text: Tok) {
        super();
    }
    getChildren(): EasySqlNode[] {
        return [];
    }
    getToks(): Tok[] {
        return [this.text];
    }
}
