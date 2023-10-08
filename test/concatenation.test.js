import {cv, expect, path} from './test_setup.js';

describe('ReactifyHTML::concatenation', () => {
    it('should join arguments to make one entity', () => {
        expect(cv.strJoin('reac', 'ti', 'fy', 'H', 'TML', ' '))
            .to.equal('reac ti fy H TML');
        expect(cv.strJoin('reac', 'ti', 'fy', 'H', 'TML', '-'))
            .to.equal('reac-ti-fy-H-TML');

        expect(cv.joinAttrs({color: 'red', shape: 'circle', radius: 10}))
            .to.equal('color="red" shape="circle" radius="10"');
        expect(cv.joinAttrs({color: 'red'}, {
            shape: 'circle'
        })).to.equal('color="red" shape="circle"');
        expect(cv.joinAttrs({color: 'red'}, {
            shape: ''
        })).to.equal('color="red" shape');
    });
});
