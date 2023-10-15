import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::Namespacing`, () => {
    it('should check if attribute is namespaced', () => {
        expect(!!cv.isNamespaced(':checked')).to.equal(false);
        expect(!!cv.isNamespaced('xmlns:prefix')).to.equal(true);
    });
});
