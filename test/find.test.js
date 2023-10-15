import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::find`, () => {
    it('should search for element occurrence', () => {
        const expr            = 'It should be know that it is important...';
        const lastOccurrence  = expr.lastIndexOf('it');
        const firstOccurrence = expr.indexOf('should');
        expect(cv.nextOf(2, expr, 'it')).to.equal(lastOccurrence);
        expect(cv.nextOf(3, expr, 'should')).to.equal(firstOccurrence);
        expect(cv.nextOf(12, expr, 'be')).to.equal(-1);
    });
});
