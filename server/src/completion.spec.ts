import { expect } from 'chai';
import { CodeCompleter } from './completion';

describe('completion', () => {
    it('should create completion items', () => {
        const cc = new CodeCompleter(null as any, null as any, null as any, null as any, null as any);
        expect(cc.sparkFuncCompletionItems.length).to.be.greaterThan(0);
    });
});
