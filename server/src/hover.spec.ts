import { expect } from 'chai';
import { HoverProvider } from './hover';

describe('hover', () => {
    let line = '';
    const doc = { getText: () => line } as any;
    const hp = new HoverProvider({ get: () => doc } as any);
    it('should show check information', () => {
        line = '-- target=check.abc';
        expect(hp.onHover({ line: 0, character: '-- target=che'.length }, '')).to.not.be.null;
    });
    it('should show function information', () => {
        line = '-- target=check.abc()';
        expect(hp.onHover({ line: 0, character: '-- target=check.a'.length }, '')).to.not.be.null;
    });
    it('should show var information', () => {
        line = '-- target=check.abc(__step__, )';
        expect(hp.onHover({ line: 0, character: '-- target=check.abc(__'.length }, '')).to.not.be.null;
    });
});
