import {cv, expect, path} from './test_setup.js';

describe('ReactifyHTML::generator', () => {
    it('should generate at most n digits', () => {
        expect(cv.randomCounter(4)).to.have.lengthOf(4);
        expect(cv.randomCounter(8)).to.have.lengthOf(8);
        expect(cv.randomCounter(14)).to.have.lengthOf.at.least(7);
    });

    it('should check script name matches generated template', () => {
        const template  = 'sc-1203.js';
        const non_match = 'sc1211.js';
        expect(cv.isGeneratedScriptName(template)).to.equal(true);
        expect(cv.isGeneratedScriptName(non_match)).to.equal(false);
    });
});
