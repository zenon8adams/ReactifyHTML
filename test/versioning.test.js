import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::Versioning`, () => {
    it('should check if path is versioned', () => {
        expect(cv.isVersioned('./img-001.jpg?v1.00')).to.equal(true);
        expect(cv.isVersioned('./img-001.jpg?1.00')).to.equal(false);
    });
});
