import {cv, expect, path, PROJECT_NAME} from './test_setup.js';

describe(`${PROJECT_NAME}::uniq`, () => {
    it('should return uniq entries in arguments', () => {
        const one     = [{Name: 'X', Year: 2013}],
              another = [{Name: 'Y', Year: 2013}],
              third   = [{Name: 'Z', Year: 2015}];

        expect(cv.uniquefy(one, another, third, 'Year')).deep.to.equal([
            {Name: 'X', Year: 2013}, {Name: 'Z', Year: 2015}
        ]);
    });
});
