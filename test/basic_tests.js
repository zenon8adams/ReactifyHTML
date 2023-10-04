import chai from 'chai';
import path from 'node:path';

import cv from '../index.js';

const expect = chai.expect;

describe('ReactifyHTML::Types', () => {
    it('should check the type of argument', () => {
        expect(cv.isArray([])).to.equal(true);
        expect(cv.isArray(0)).to.equal(false);

        expect(cv.isObject(0)).to.equal(false);
        expect(cv.isObject({})).to.equal(true);

        expect(cv.isBoolean(0)).to.equal(false);
        expect(cv.isBoolean(false)).to.equal(true);

        expect(cv.isString(0)).to.equal(false);
        expect(cv.isString('')).to.equal(true);

        expect(cv.isNumber(0)).to.equal(true);
        expect(cv.isNumber('')).to.equal(false);

        expect(cv.isRegExp(/^$/)).to.equal(true);
        expect(cv.isRegExp(new RegExp('^$'))).to.equal(true);
        expect(cv.isRegExp('')).to.equal(false);
    });
});

describe('ReactifyHTML::Existence', () => {
    it('should check for argument existence', () => {
        expect(cv.isEmpty('.')).to.equal(false);
        expect(cv.isEmpty('')).to.equal(!cv.isNotEmpty(''));

        expect(cv.isNull(null)).to.equal(true);
        expect(cv.isNull(undefined)).to.equal(false);
        expect(cv.isNull(null)).to.equal(!cv.isNotNull(null));
        expect(cv.isNull(0)).to.equal(false);

        expect(cv.isBehaved(null)).to.equal(true);
        expect(cv.isBehaved(undefined)).to.equal(false);
        expect(cv.isBehaved(0)).to.equal(true);
        expect(cv.isBehaved(null)).to.equal(!cv.isNotBehaved(null));

        expect(cv.isDefined(null)).to.equal(false);
        expect(cv.isDefined(undefined)).to.equal(false);
        expect(cv.isDefined(0)).to.equal(true);
        expect(cv.isDefined(0)).to.equal(!cv.isNotDefined(0));
    });
});

describe('ReactifyHTML::Url', () => {
    it('should check if path is a url', () => {
        expect(cv.isAbsoluteURI(null)).to.equal(false);
        expect(cv.isAbsoluteURI('/usr/bin')).to.equal(false);
        expect(cv.isAbsoluteURI('http://')).to.equal(true);
        expect(cv.isAbsoluteURI('google.com')).to.equal(false);
    });
});

describe('ReactifyHTML::Element', () => {
    it('should return last entry of container', () => {
        expect(cv.lastEntry([1, 2, 3])).to.equal(3);
        expect(cv.lastEntry([])).to.equal(undefined);
    });
});

describe('ReactifyHTML::Versioning', () => {
    it('should check if path is versioned', () => {
        expect(cv.isVersioned('./img-001.jpg?v1.00')).to.equal(true);
        expect(cv.isVersioned('./img-001.jpg?1.00')).to.equal(false);
    });
});

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

describe('ReactifyHTML::RegularExpressionSort', () => {
    it('should sort `re` matches by `index` in descending order', () => {
        const re      = /([a-z]+)/gm;
        const expr    = 'split this string into substrings';
        const indexes = [23, 18, 11, 6, 0];
        const matches = Array.from(expr.matchAll(re))
                            .sort(cv.sortIndexDesc)
                            .map(m => m.index);
        expect(indexes).deep.to.equal(matches);
    });
});

describe('ReactifyHTML::find', () => {
    it('should search for element occurrence', () => {
        const expr            = 'It should be know that it is important...';
        const lastOccurrence  = expr.lastIndexOf('it');
        const firstOccurrence = expr.indexOf('should');
        expect(cv.nextOf(2, expr, 'it')).to.equal(lastOccurrence);
        expect(cv.nextOf(3, expr, 'should')).to.equal(firstOccurrence);
        expect(cv.nextOf(12, expr, 'be')).to.equal(-1);
    });
});

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
        expect(cv.getRootDirectory('/usr/bin'))
            .to.equal(path.join(path.sep, 'usr'));
        expect(cv.getRootDirectory('/')).to.equal(path.sep);
    });
});

describe('ReactifyHTML::StringEdit', () => {
    it('should remove quote from maybe quoted string', () => {
        expect(cv.unQuote('"This"')).to.equal('This');
        expect(cv.unQuote('This')).to.equal('This');
        expect(cv.unQuote('&quot;This')).to.equal('&quot;This');
        expect(cv.unQuote('This&quot;')).to.equal('This&quot;');
        expect(cv.unQuote('\\"This\\"')).to.equal('This');
    });

    it('should convert first character only to upper case', () => {
        expect(cv.capitalize('Hello')).to.equal('Hello');
        expect(cv.capitalize('hEllO')).to.equal('Hello');
        expect(cv.capitalize('h')).to.equal('H');
        expect(cv.capitalize('')).to.equal('');
    });
});

describe('ReactifyHTML::Namespacing', () => {
    it('should check if attribute is namespaced', () => {
        expect(cv.isNamespaced(':checked')).to.equal(false);
        expect(cv.isNamespaced('xmlns:prefix')).to.equal(true);
    });
});

describe('ReactifyHTML::generator', () => {
    it('should generate at most n digits', () => {
        expect(cv.randomCounter(4)).to.have.lengthOf(4);
        expect(cv.randomCounter(8)).to.have.lengthOf(8);
        expect(cv.randomCounter(14)).to.have.lengthOf.at.least(7);
    });
});

describe('ReactifyHTML::selfClosingTags', () => {
    it('should close self unterminated html tags', () => {
        const expr     = '<input type="text" name="dob">';
        const expected = expr.slice(0, -1) + '/>';

        expect(cv.closeSelfClosingTags(expr)).to.equal(expected);
    });
});

describe('ReactifyHTML::uniq', () => {
    it('should return uniq entries in arguments', () => {
        const one     = [{Name: 'X', Year: 2013}],
              another = [{Name: 'Y', Year: 2013}],
              third   = [{Name: 'Z', Year: 2015}];
        expect(cv.uniquefy(one, another, third, 'Year')).deep.to.equal([
            {Name: 'X', Year: 2013}, {Name: 'Z', Year: 2015}
        ]);
    });
});

describe('ReactifyHTML::naming', () => {
    it('should generate name from path', () => {
        expect(cv.deriveNameFrom('pages/my-home-page.js'))
            .to.equal('PagesMyHomePage');

        expect(cv.deriveNameFrom('pages/002 my home page'))
            .to.equal('Pages002MyHomePage');

        expect(cv.deriveNameFrom('002 my home page'))
            .to.equal('A_002MyHomePage');
    });
});
