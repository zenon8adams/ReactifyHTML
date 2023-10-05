import {cv, expect, path} from './test_setup.js';

describe('ReactifyHTML::path', () => {
    it('should return reference to previous directory', () => {
        expect(cv.bt(path.join('usr', 'local', 'bin')))
            .to.equal(path.join('usr', 'local'));
    });

    it('should return absolute path of argument', () => {
        expect(cv.fullPathOf('.')).to.equal(process.cwd());
        expect(cv.fullPathOf('..')).to.equal(cv.bt(process.cwd()));
    });

    it('should check if basename of provided path refers to same file', () => {
        expect(cv.isSelfReference('/usr/local/my-file.txt', 'my-file.txt'))
            .to.equal(true);
        expect(cv.isSelfReference('/usr/local/my-file.txt', 'other-file.txt'))
            .to.equal(false);
    });

    it('should remove every back reference in path (..)', () => {
        expect(cv.removeBackLinks('/usr/../bin')).to.equal('/usr/bin');
        expect(cv.removeBackLinks('/usr/../')).to.equal('/usr/');
        expect(cv.removeBackLinks('../..')).to.equal('');
    });

    it('should return parent path', () => {
        expect(cv.getRootDirectory('/usr/bin')).to.equal('/usr');
        expect(cv.getRootDirectory('/')).to.equal('/');
    });

    it('should break down path details', () => {
        const os_re = p => p.replace('/', path.sep);
        const file      = '/home/user/files/img-driver.jpg?v1.23.22';
        const fileInfo  = cv.parseFile(file);

        expect(fileInfo.original).to.equal(os_re(file));
        expect(fileInfo.realpath)
            .to.equal(os_re(file.slice(0, file.indexOf('?'))));
        expect(fileInfo.extv2)
            .to.equal(file.slice(file.indexOf('.') + 1, file.indexOf('?')));
        expect(fileInfo.version).to.equal(file.slice(file.indexOf('?') + 1));
    });
});
