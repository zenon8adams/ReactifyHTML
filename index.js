/*
 * MIT License
 *
 *
 *   Copyright (c) 2023 Meekness Adesina
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the "Software"),
 *   to deal in the Software without restriction, including without limitation
 *   the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *   and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *   DEALINGS IN THE SOFTWARE.
 */
'use strict';

const fsExtra   = require('fs-extra');
const moveAll   = fsExtra.move;
const duplicate = fsExtra.copy;
const os        = require('node:os');
const fs        = require('node:fs');
const fsp       = require('node:fs/promises');
const readline  = require('node:readline/promises');
const jsdom     = require('jsdom');
const path      = require('node:path');
const process   = require('node:process')
const {rimraf}  = require('rimraf');
const util      = require('util');

// Logger dependencies
const winston                                       = require('winston');
const {combine, colorize, align, printf, timestamp} = winston.format;

// Assertion dependencies
const assert = require('assert');

const REPL_ID = 'hTmL';

modifyLock(REPL_ID);

const STYLE_TAG  = 'STYLE_CONTENT';
const APP_TAG    = 'APP_CONTENT';
const HOOKS_TAG  = 'HOOKS_CONTENT';
const TITLE_TAG  = 'TITLE_CONTENT';
const META_TAG   = 'META_CONTENT';
const LINK_TAG   = 'LINK_CONTENT';
const PAGE_TAG   = 'PAGE_CONTENT';
const ROUTES_TAG = 'ROUTES_CONTENT';

modifyLock(
    REPL_ID, STYLE_TAG, APP_TAG, HOOKS_TAG, TITLE_TAG, META_TAG, LINK_TAG,
    PAGE_TAG, ROUTES_TAG);

const STYLE_INC_TAG  = 'STYLE_INCLUDE';
const HOOKS_INC_TAG  = 'HOOKS_INCLUDE';
const SCRIPT_INC_TAG = 'SCRIPT_INCLUDE';
const ROUTES_INC_TAG = 'ROUTES_INCLUDE';

modifyLock(STYLE_INC_TAG, HOOKS_INC_TAG, SCRIPT_INC_TAG, ROUTES_INC_TAG);

const ROOT_ATTR_TAG = 'ROOT_ATTRIBUTES';

modifyLock(ROOT_ATTR_TAG);

const BUILD_DIR_TAG      = 'BUILD_DIR';
const ENV_PRE_TAG        = 'ENV_PRESENT';
const ASSETS_DIR_TAG     = 'ASSETS_DIR';
const ASSETS_PRESENT_TAG = 'ASSET_PRESENT';
const FAVICON_DIR_TAG    = 'FAVICON_DIR';

modifyLock(
    BUILD_DIR_TAG, ENV_PRE_TAG, ASSETS_DIR_TAG, ASSETS_PRESENT_TAG,
    FAVICON_DIR_TAG);

// Inject the meta description and title into App.jsx
const PAGE_INFO_TAG = 'CASE_PAGE_INFO';

const PAGE_NAME_TAG = 'PAGE_NAME';

modifyLock(PAGE_INFO_TAG, PAGE_NAME_TAG);

const BUILD_DIR  = 'build';
const HOOKS_DIR  = 'hooks';
const ASSETS_DIR = 'assets';

modifyLock(BUILD_DIR, HOOKS_DIR, ASSETS_DIR);

const converterConfig = {
    useHooks: false,
    searchDepth: -1,
    deduceAssetsPathFromBaseDirectory: true,
    usePathRelativeIndex: true,
    archive: false
};

const MisMatchPolicy = Object.freeze({
    Overwrite: Symbol('overwrite'),
    Merge: Symbol('merge'),
    Leave: Symbol('leave')
});

// Make it unmodifiable.
modifyLock(converterConfig);

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp({format: 'YYYY-MM-DD hh:mm:ss.SSS A'}), align(),
        printf((info) => {
            return `[${info.timestamp}] ${info.level}: ${info.message}`;
        })),
    transports: [new winston.transports.File({
        filename: `logs/progress-${new Date().toISOString().slice(0, 10)}.log`,
        maxsize: 1024 * 1024 * 10  // 10MB
    })]
});

const {error, warn, info, verbose, debug, silly} = logger;

logger.info = function() {
    info(util.format.apply(null, arguments));
};

logger.error =
    function() {
    error(serializeError(arguments[0]));
}

function serializeError(error) {
    // Deep copy the string since nodejs doesn't want to
    // display the error detail as string
    return deepClone(error.stack);
}

const mainSourceFile = process.argv[2] ?? 'examples/index.html';
const mainSourceDir  = path.dirname(mainSourceFile);

modifyLock(mainSourceFile, mainSourceDir);

/*
 * Program starting point.
 */
generateAllPages({href: mainSourceFile, ...parseFile(mainSourceFile), dir: ''});

async function generateAllPages(landingPage) {
    let allPageMetas = [], allStyles = '', allLinks = [], allScripts = [];

    const {useHooks} = converterConfig;
    assert(isDefined(useHooks));

    async function generateAllPagesImpl(pages, resourcePath) {
        let   pagesStream      = [].concat(pages);
        let   updatedLinks     = [];
        let   currentPageStyle = '';
        const qLookup          = {};
        try {
            for (let i = 0; i < pagesStream.length; ++i) {
                const page = pagesStream[i];
                // Check if we have the page queued already.
                if (qLookup[page.href]) {
                    continue;
                }

                qLookup[page.href] = true;

                const pageLocationFile = page?.res?.realpath ?? page.href;
                const pageLocation     = path.dirname(pageLocationFile);

                logger.info(
                    '\n\n', '='.repeat(50), pageLocationFile, '='.repeat(50),
                    '\n\n');

                const content = await fsp.readFile(pageLocationFile);

                const dom  = new jsdom.JSDOM(content);
                const doc  = dom.window.document;
                const root = doc.querySelector('html');

                /*\
                 * We don't need edited attributes
                 * since we know that we are not going to
                 * be loaded in a react sensitive context
                \*/

                const pageMetas        = extractMetas(doc, pageLocation);
                const currentPageLinks = extractLinks(doc, pageLocation);
                const pageTitle        = extractTitle(doc, root);

                const otherPages = setDifference(
                    await extractAllPageLinks(
                        doc, pageLocationFile, resourcePath),
                    pagesStream, 'href');

                reconstructTree(root);

                // FIXME: Scripts can be loaded either via local hooks
                //  or in the global index page.
                const scripts    = extractAllScripts(doc);
                const pageStyles = extractStyles(doc);

                await updateMissingLinks(
                    doc, pageLocationFile, resourcePath, currentPageLinks,
                    scripts);

                updatedLinks = await updateLinksFromLinksContent(
                    doc, pageLocationFile, resourcePath, currentPageLinks);

                allLinks = uniquefy(allLinks, updatedLinks, 'href');

                currentPageStyle = await updateStyleLinks(
                    doc, pageLocationFile, resourcePath, pageStyles);

                allStyles = strJoin(allStyles, currentPageStyle, '\n');

                const rawHTML = closeSelfClosingTags(
                    refitTags(dom.window.document.body.innerHTML));

                logger.info('All scripts for page:', page.realpath, scripts);
                logger.info('All styles for page:', page.realpath, pageStyles);

                const pageDescription = extractDescription(pageMetas);
                const pageName        = deriveNameFrom(page.base);
                const pageFile =
                    path.join((page?.res?.dir ?? ''), pageName) + '.jsx';
                const pageInfo = {
                    name: pageName,
                    title: pageTitle,
                    description: pageDescription,
                    path: pageFile
                };


                logger.info('PageInfo: ', pageInfo);

                await duplicatePageTemplate(pageFile, resourcePath);
                // If this is the landing page
                if (i === 0) {
                    await emplaceRootAttrs(root, resourcePath);
                    await emplaceTitle(pageTitle, resourcePath);
                }

                await             emplaceHTML(rawHTML, pageInfo, resourcePath);
                useHooks && await addScripts(scripts, pageFile, resourcePath);

                Object.assign(page, {...page, info: pageInfo});
                allScripts   = useHooks ?
                      allScripts :
                      uniquefy(allScripts, scripts, 'scriptName');
                allPageMetas = allPageMetas.concat(pageMetas);

                // Queue newly fetched pages to the stream.
                pagesStream = pagesStream.concat(otherPages);

                logger.info(
                    '\n\n', '='.repeat(50), pageLocationFile, '='.repeat(50),
                    '\n\n');
            }
        } catch (err) {
            logger.error(err);
        }

        return pagesStream;
    }

    try {
        await cleanOldFiles();
        const processingParams = await initializeProjectStructure();

        const     allPages =
            await generateAllPagesImpl([landingPage], processingParams);


        logger.info('allPages: ', allPages);

        await emplaceStyle(allStyles, processingParams);
        const appliedMetas = await emplaceMetas(allPageMetas, processingParams);
        await                      emplaceLinks(allLinks, processingParams);

        !useHooks && await addScripts(allScripts, null, processingParams);

        await emplaceApp(allPages, processingParams);

        await fixupWebpack(processingParams);

        await removeUnusedTags(allPages, processingParams);

        await removeTemplates(processingParams);
    } catch (err) {
        logger.error(err);
        await cleanOldFiles();
        process.exit(1);
    }

    process.exit(0);
}

function deepClone(str) {
    return (' ' + str).slice(1);
}

async function removeTemplates(resourcePath) {
    const {pageB} = resourcePath;
    assert(isString(pageB));

    const pageTemplateFullPath = path.join(
        pageB,
        'page-base' +
            '.jsx');

    logger.info(
        'removeTemplates() -- pageTemplateFullPath:', pageTemplateFullPath);

    await removePath(pageTemplateFullPath);
}

async function removeUnusedTags(pages, resourcePath) {
    assert(isArray(pages));
    const {appB, scriptB, rootB, publicB, pageB, webpackB} = resourcePath;
    assert(isDefined(appB));
    assert(isDefined(scriptB));
    assert(isDefined(rootB));
    assert(isDefined(publicB));
    assert(isDefined(pageB));
    assert(isDefined(webpackB));

    logger.info('resourcePath', resourcePath);
    await emplaceImpl(STYLE_INC_TAG, scriptB, scriptB, '');

    for (const page of pages) {
        const {name}       = page;
        const pageFullPath = path.join(pageB, page.info.path);
        await emplaceImpl(STYLE_INC_TAG, pageFullPath, pageFullPath, '');
        await emplaceImpl(HOOKS_TAG, pageFullPath, pageFullPath, '');
        await emplaceImpl(HOOKS_INC_TAG, pageFullPath, pageFullPath, '');
    }

    await emplaceImpl(SCRIPT_INC_TAG, rootB, rootB, '');
    await emplaceImpl(ROOT_ATTR_TAG, rootB, rootB, ' lang="en"');
    await emplaceImpl(ENV_PRE_TAG, webpackB, webpackB, '');

    const favicon        = linkTags.filter(link => link.rel === 'icon')[0];
    const publicBaseName = path.basename(publicB);
    const faviconTemplate =
        buildPathTemplateFrom(path.join(publicBaseName, favicon.href));

    await emplaceImpl(FAVICON_DIR_TAG, webpackB, webpackB, faviconTemplate);


    const indexer        = await getIndexer();
    const assetIsPresent = isNotEmpty(Object.keys(indexer.saved));
    await emplaceImpl(
        ASSETS_PRESENT_TAG, webpackB, webpackB,
        assetIsPresent ? 'true' : 'false');

    await emplaceImpl(PAGE_INFO_TAG, appB, appB, '');
    await emplaceImpl(ROUTES_TAG, appB, appB, '');
}

function buildPathTemplateFrom(dir) {
    const link =
        dir.split(path.sep)
            .filter(p => isNotEmpty(p))
            .reduce((acc, p) => isEmpty(acc) ? `'${p}'` : `${acc}, '${p}'`, '');

    return link;
}

async function addScripts(scripts, pagePath, resourcePath) {
    const {publicB, srcB}       = resourcePath;
    const conventionScriptPaths = buildAssetLookup();
    const {useHooks}            = converterConfig;
    assert(isDefined(publicB));
    assert(isDefined(srcB));
    assert(isDefined(useHooks) && isBoolean(useHooks));

    scripts
        .map(script => {
            const scriptInfo = parseFile(script.scriptName);
            const conventionalScriptPath =
                conventionScriptPaths[scriptInfo.extv2] ?? 'script';

            const scriptFile = path.join(ASSETS_DIR, conventionalScriptPath);
            const scriptsFullPath = path.join(
                !converterConfig.useHooks ? publicB : srcB, scriptFile);
            return Object.assign(
                script,
                {...script, path: scriptsFullPath, shortPath: scriptFile});
        })
        .filter(
            script =>
                !fs.existsSync(path.join(script.path, script.scriptName)));

    const useScripts = scripts.filter(script => script.isInline);

    if (isEmpty(useScripts) && !useHooks) {
        await removeHooks('*', resourcePath);
    } else {
        await Promise.all(useScripts.map(async (script) => {
            await        fsp.mkdir(script.path, {recursive: true});
            return await fsp.writeFile(
                path.join(script.path, script.scriptName), script.content)
        }));
    }

    if (useHooks) {
        await emplaceHooks(scripts, pagePath, resourcePath);
    } else {
        await emplaceInRoot(scripts, resourcePath);
    }
}

async function emplaceInRoot(scripts, resourcePath) {
    assert(isArray(scripts));
    const scriptsList =
        scripts
            .reduce(
                (acc, script) => {
                    if (!script.isInline) {
                        const attrs = refitTags(joinAttrs(
                            getAttributesRaw(script.script),
                            {src: script.scriptName}));
                        return acc + `<script ${attrs}></script>` +
                            '\n\t';
                    } else {
                        return acc + '<script src="' +
                            path.join(script.shortPath, script.scriptName) +
                            '" type="' + script.mime + '"></script>\n\t';
                    }
                },
                '\n\t')
            .trimEnd();

    const {rootB} = resourcePath;
    assert(isDefined(rootB));

    await emplaceImpl(SCRIPT_INC_TAG, rootB, rootB, scriptsList);
    await removeHooks('*', resourcePath);
}

function deriveNameFrom(filePath) {
    const {base, ext} = path.parse(filePath);
    const name        = base.slice(0, -ext.length);
    const page        = Array.from(name.matchAll(/([a-zA-Z]+)/g))
                     .sort((one, other) => other.index - one.index)
                     .reduce((acc, m) => acc + capitalize(m[1]), '')
                     .concat('Page');
    return page;
}

function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

function strJoin() {
    const delimiter = lastEntry(Array.from(arguments));
    const strings   = Array.from(arguments).slice(0, -1);

    const single = strings.reduce(
        (acc, str, idx) => idx == 0 ? str :
            isEmpty(acc)            ? str :
                                      acc + delimiter + str,
        '');

    return single;
}

function setDifference(one, other, property) {
    return one.filter(
        oneItem => !other.find(
            otherItem => otherItem[property] === oneItem[property]));
}

function uniquefy() {
    const property    = lastEntry(Array.from(arguments));
    const collections = Array.from(arguments).slice(0, -1);
    const uniqueMap   = new Map();

    const uniqueCollection =
        collections.reduce((acc, collection) => acc.concat(collection), [])
            .filter(
                entry =>
                    isDefined(entry[property]) && isNotEmpty(entry[property]))
            .filter(entry => {
                if (uniqueMap.get(entry[property]))
                    return false;

                uniqueMap.set(entry[property], true);
                return true;
            });

    return uniqueCollection;
}

function pageIsInStream(stream, page) {
    return stream.find(p => p.href === page.href);
}

function joinAttrs(attrs, extras /* nullable */) {
    assert(isDefined(attrs) && isObject(attrs));

    return Object.entries({...attrs, ...extras})
        .reduce(
            (acc, [k, v]) =>
                acc + k + (isNotEmpty(v) ? ('="' + v + '" ') : ' '),
            '')
        .trim();
}

async function duplicatePageTemplate(pagePath, resourcePath) {
    const {pageB} = resourcePath;
    assert(isDefined(pageB));

    const refPageName     = 'page-base.jsx';
    const refPageFullPath = path.join(pageB, refPageName);
    const newPageFullPath = path.join(pageB, pagePath);

    await fsp.mkdir(path.dirname(newPageFullPath), {recursive: true});

    await fsp.copyFile(refPageFullPath, newPageFullPath);
}

async function emplaceHooks(scripts, pagePath, resourcePath) {
    const {pageB, srcB} = resourcePath;
    assert(isDefined(pageB));
    assert(isDefined(srcB));

    const scriptsList = scripts.reduce(
        (acc, script) => acc + '\'' + script.scriptName + '\'' +
            ',\n\t',
        '\n\t');
    const hooksPath   = path.join(srcB, 'hooks/useScript');
    const relHookIncl = path.relative(pageB, srcB);
    const hook =
        `\n\tconst [loadedScripts, error] = useScript([${scriptsList}]);`;
    const include = `\nimport useScript from '${relHookIncl}';`;

    const pageFullPath = path.join(pageB, pagePath);

    await emplaceImpl(HOOKS_TAG, pageFullPath, pageFullPath, hook);
    await emplaceImpl(HOOKS_INC_TAG, pageFullPath, pageFullPath, include);
}

async function removeHooks(hooks, resourcePath) {
    assert(isDefined(resourcePath.srcB));

    const removeAllHooks = !Array.isArray(hooks);
    const hooksFullPath  = path.join(resourcePath.srcB, HOOKS_DIR);
    if (removeAllHooks) {
        await deleteDirectory(hooksFullPath);
    } else {
        hooks.forEach(async (hook) => {
            const hookFile = hook + '.jsx';
            await deleteFiesMatch(hooksFullPath, hookFile);
        });
    }
}

async function deleteFilesMatch(root, pattern) {
    assert(isRegExp(pattern));

    (await fsp.readdir(root)).forEach((file) => {
        const filePath = path.join(root, file);
        const stat     = fs.statSync(filePath);

        if (file.match(pattern)) {
            removePath(file);
        } else if (stat.isDirectory()) {
            deleteFilesMatch(filePath, pattern);
        }
    });
}

async function emplaceRootAttrs(node, resourcePath) {
    const {rootB} = resourcePath;
    const attrs   = joinAttrs(getAttributesRaw(node));
    assert(isDefined(rootB));
    assert(isString(attrs));

    if (isNotEmpty(attrs)) {
        await emplaceImpl(ROOT_ATTR_TAG, rootB, rootB, ' ' + attrs);
    }
}

async function emplaceLinks(links, processingParams) {
    return await emplaceLinksOrMetasImpl(
        links, true /* isLink */, processingParams);
}

async function emplaceMetas(metas, processingParams) {
    if (isEmpty(metas))
        metas.push({charset: 'utf-8'});

    return await emplaceLinksOrMetasImpl(
        metas, false /* isLink */, processingParams);
}

async function emplaceLinksOrMetasImpl(linksOrMetas, isLink, resourcePath) {
    const tag       = isLink ? '<link ' : '<meta ';
    const finalList = await overrideSet(
        isLink ? linkTags : metaTags, linksOrMetas, resourcePath);
    const stringLinksOrMetas =
        finalList
            .map(current => {
                const joint = joinAttrs(current);
                return tag + joint + '/>';
            })
            .reduce((cur, linkOrMeta) => cur + linkOrMeta + '\n', '\n');

    const {rootB} = resourcePath;
    await emplaceImpl(
        isLink ? LINK_TAG : META_TAG, rootB, rootB, stringLinksOrMetas);

    return finalList;
}

async function overrideSet(standard, given, resourcePath) {
    logger.info('overrideSet(): given --- ', given, ', standard: ', standard);
    const visibilityMap = new Map();
    const finalSet      = Object.assign([], standard);

    standard.forEach(
        (entry, index) => visibilityMap.set(entry.name ?? entry.rel, index));
    given.forEach(async (entry) => {
        const idx = entry.name ?? entry.rel;
        if (idx && isBehaved(visibilityMap.get(idx))) {
            let removeFromFinal = true;
            if (idx === 'icon' && entry.href.match('favicon')) {
                removeFromFinal = await updateFaviconAddress(
                    entry, standard[visibilityMap.get(idx)], resourcePath);
            }
            removeFromFinal &&
                finalSet.splice(visibilityMap.get(idx), 1, entry);
        } else
            finalSet.push(entry);
    });

    logger.info('FinalSet --- ', finalSet);

    return finalSet;
}

async function updateFaviconAddress(newFavicon, oldFavicon, resourcePath) {
    // Precondition
    assert(
        newFavicon && newFavicon.href &&
        newFavicon.href.indexOf('favicon') !== -1 && newFavicon.rel === 'icon');
    assert(
        oldFavicon && oldFavicon.href &&
        oldFavicon.href.indexOf('favicon') !== -1 && oldFavicon.rel === 'icon');
    assert(isNotEmpty(Object.keys(resourcePath)));

    const {publicB, webpackB} = resourcePath;
    assert(isDefined(publicB));
    assert(isDefined(webpackB));

    const oldFaviconFile = path.join(publicB, oldFavicon.href);
    const newFaviconFile = path.join(publicB, newFavicon.href);

    try {
        if (fs.existsSync(newFaviconFile)) {
            assert(fs.existsSync(oldFaviconFile));
            await removePath(oldFaviconFile);

            const newFaviconTemplate = buildPathTemplateFrom(newFavicon.href);
            await emplaceImpl(
                FAVICON_DIR_TAG, webpackB, webpackB, newFaviconTemplate);
        }
    } catch (err) {
        logger.error(err);
        return false;
    }

    return true;
}

async function emplaceTitle(title, processingParams) {
    const {rootB} = processingParams;
    assert(isDefined(rootB));

    await emplaceImpl(TITLE_TAG, rootB, rootB, title);
}

async function emplaceStyle(content, resourcePath) {
    const {style, styleB, appB, scriptB} = resourcePath;
    assert(isDefined(style));
    assert(isDefined(styleB));
    assert(isDefined(appB));
    assert(isDefined(scriptB));

    if (isEmpty(content)) {
        try {
            logger.info('emplaceStyle() -- isEmpty(content): ', styleB);
            removePath(styleB);
        } catch (err) {
            logger.error(err);
        }
        return;
    }

    const styleInclude = `\nimport '${path.basename(resourcePath.style)}';`;
    await emplaceImpl(STYLE_TAG, style, styleB, content);
    await emplaceImpl(STYLE_INC_TAG, appB, appB, styleInclude);
    await emplaceImpl(STYLE_INC_TAG, scriptB, scriptB, styleInclude);
}

async function fixupWebpack(resourcePath) {
    const {webpackB, publicB} = resourcePath;
    assert(isDefined(webpackB));
    assert(isDefined(publicB));

    const envFile                = '.env';
    const envProposedFullPath    = path.join(mainSourceDir, envFile);
    const envDestinationFullPath = path.join(bt(publicB), envFile);
    if (fs.existsSync(envProposedFullPath)) {
        await fsp.copyFile(envProposedFullPath, envDestinationFullPath);
        await emplaceImpl(ENV_PRE_TAG, webpackB, webpackB, '.');
    }

    await emplaceImpl(ASSETS_DIR_TAG, webpackB, webpackB, ASSETS_DIR);
    await emplaceImpl(BUILD_DIR_TAG, webpackB, webpackB, BUILD_DIR);
}

function bt(dir) {
    assert(isDefined(dir) && isString(dir));

    return path.join(dir, '..');
}
/*
 * Setup navigation for the pages.
 */
async function emplaceApp(pages, resourcePath) {
    const {appB, pageB} = resourcePath;
    assert(isArray(pages));
    assert(isString(appB));

    let   allPageCases = '';
    let   allRoutes    = '';
    let   routesIncl   = '';
    const isSinglePage = pages.length === 1;
    for (const page of pages) {
        const {name, title, description} = page.info;
        const pageUrl = isSinglePage ? '' : name.toLowerCase();
        allPageCases  = strJoin(
             allPageCases, `case '/${pageUrl}':\n`, `\ttitle = '${title}';\n`,
            `\tmetaDescription = '${description}';\n`, `\tbreak;\n`, '\t');
        allRoutes = strJoin(
            allRoutes, `<Route`, `path="/${pageUrl}"`,
            `element={<${name} />} />\n\t\t`, ' ');

        const pageIncl = path.join('pages', path.normalize(page.info.path));

        routesIncl = routesIncl + `\nimport ${name} from '${pageIncl}';`;
    }

    await emplaceImpl(PAGE_INFO_TAG, appB, appB, allPageCases.trimRight());
    await emplaceImpl(ROUTES_TAG, appB, appB, allRoutes.trimRight());
    await emplaceImpl(ROUTES_INC_TAG, appB, appB, routesIncl.trimRight());
}

async function emplaceHTML(rawHTML, pageInfo, resourcePath) {
    const {pageB} = resourcePath;
    assert(isDefined(pageB));

    const refPageName     = 'page-base.jsx';
    const refPageFullPath = path.join(pageB, refPageName);
    const newPageFullPath = path.join(pageB, pageInfo.path);

    await emplaceImpl(
        PAGE_TAG, refPageFullPath, newPageFullPath,
        useJSXStyleComments(rawHTML));
    await emplaceImpl(
        PAGE_NAME_TAG, newPageFullPath, newPageFullPath, pageInfo.name);
}

function useJSXStyleComments(rawHTML) {
    assert(isDefined(rawHTML) && isString(rawHTML));

    return rawHTML.replace(/<!--((?:.|\n|\r)*?)-->/gm, '{/*\$1*/}');
}

async function emplaceImpl(tag, readPath, writePath, replacement) {
    assert(isString(tag) && isNotEmpty(tag));
    assert(isString(readPath) && isNotEmpty(readPath));
    assert(isString(writePath) && isNotEmpty(writePath));
    assert(isString(replacement));

    const content = await fsp.readFile(readPath);

    logger.info('Args:');
    logger.info('Tag:', tag);
    logger.info('readPath:', readPath);
    logger.info('writePath:', writePath);
    logger.info('replacement:', clip(replacement, 50), '\n\n');

    const toBeWritten = content.toString().replace(
        new RegExp(`@\{${tag}\}`, 'gm'), replacement);

    logger.info('Result:\n', clip(toBeWritten, 500));

    await fsp.writeFile(writePath, toBeWritten);
}

function clip(str, maxLen) {
    const mL         = isNotBehaved(maxLen) ? str.length : maxLen;
    const clippedStr = str.slice(0, Math.min(mL, str.length));
    return clippedStr.length === str.length ? clippedStr : clippedStr + '...';
}

async function updateLinksFromLinksContent(
    doc, pageSourceFile, resourcePath, links) {
    assert(isString(pageSourceFile));

    const {publicB} = resourcePath;
    assert(isDefined(publicB));

    for (const link of links) {
        if (isAbsoluteURI(link.href))
            continue;

        const linkFullPath = path.join(publicB, link.href);
        if (!fs.existsSync(linkFullPath))
            continue;

        try {
            const content = (await fsp.readFile(linkFullPath)).toString();
            const updatedContent = await updateStyleLinks(
                doc, pageSourceFile, resourcePath, content);
            await fsp.writeFile(linkFullPath, updatedContent);

        } catch (err) {
            console.error(err);
        };
    }

    return links;
}

async function updateStyleLinks(doc, pageSourceFile, resourcePath, style) {
    const fixables = Array.from(style.matchAll(/url\s*\(([^\)]+)\)/gm))
                         .sort((one, other) => other.index - one.index)
                         .filter(link => {
                             return !isAbsoluteURI(unQuote(link[1]));
                         });

    logger.info('Fixables:', fixables);

    if (isEmpty(fixables)) {
        return style;
    }

    const links = fixables.map((link, index) => ({
                                   value: unQuote(link[1]),
                                   rela: path.dirname(pageSourceFile),
                                   recovery: index
                               }));

    const     resolvedAssetsPath =
        await retrieveAssetsFromGlobalDirectory(pageSourceFile, links);

    await copyResolvedAssetsToOutputDirectory(
        resolvedAssetsPath, links, resourcePath);
    for (const link of links) {
        const patch = resolvedAssetsPath[link.value];
        if (isNotBehaved(patch))
            continue;

        const finalDir       = generateAssetsFinalDirectory(link);
        const assetsRealPath = path.join(ASSETS_DIR, finalDir);
        const assetFile = path.join(assetsRealPath, path.basename(link.value));
        const recInfo   = fixables[link.recovery];
        style = style.substring(0, recInfo.index) + `url("${assetFile}")` +
            style.substring(recInfo.index + recInfo[0].length);
    }

    return style;
}

function unQuote(link) {
    const q     = ['"', '\'', '`', '&quot;', '\\"', '\\\'', '\\`'];
    link        = link.trim();
    const begin = q.findIndex(b => link.slice(0, b.length) === b);
    if (begin === -1)
        return link;
    const end = q.findLastIndex(b => link.slice(-b.length) === b);
    if (end === -1)
        return link;
    return link.slice(q[begin].length, -q[end].length);
}

async function updateMissingLinks(doc, pageSourceFile, resourcePath) {
    const modifiables = buildExternalSource(
        doc, pageSourceFile, Array.from(arguments).slice(3));
    const modifiableKeys = modifiables.map(selection => selection.value);

    logger.info('Modifiables:', modifiables);

    if (isEmpty(modifiables))
        return;


    const     resolvedAssetsPath =
        await retrieveAssetsFromGlobalDirectory(pageSourceFile, modifiables);

    await copyResolvedAssetsToOutputDirectory(
        resolvedAssetsPath, modifiables, resourcePath);

    for (const asset of modifiables) {
        const repl     = resolvedAssetsPath[asset.value];
        const finalDir = generateAssetsFinalDirectory(asset);
        if (isNotBehaved(repl))
            continue;

        const augmentedPath = path.join(ASSETS_DIR, finalDir, repl.base);
        if (asset.isHTMLElement) {
            // All attributes have been augmented at this point
            // changing it requires a change in the augmented version
            // and not the real attribute.
            asset.element.setAttributeNS(
                null, augment(asset.source), augmentedPath);
        } else {
            Object.assign(
                asset.element,
                {...asset.element, [asset.source]: augmentedPath});
        }
    }

    logger.info(
        'ResolvedAssetsPath', resolvedAssetsPath, 'Modified-Modifiables',
        modifiables);
}

async function copyResolvedAssetsToOutputDirectory(
    resolvedAssetsPath, assetsList, resourcePath) {
    const {publicB}              = resourcePath;
    const {usePathRelativeIndex} = converterConfig;
    assert(isDefined(publicB));
    assert(isBoolean(usePathRelativeIndex));

    const assetDirLookup = buildAssetLookup();
    for (const asset of assetsList) {
        const repl = resolvedAssetsPath[asset.value];
        if (isNotBehaved(repl))
            continue;

        const finalDir            = generateAssetsFinalDirectory(asset);
        const assetsRealPath      = path.join(ASSETS_DIR, finalDir);
        const destinationFullPath = path.join(publicB, assetsRealPath);
        if (!fs.existsSync(destinationFullPath)) {
            await fsp.mkdir(destinationFullPath, {recursive: true});
        }

        const destinationAssetFullPath =
            path.join(destinationFullPath, repl.base);

        logger.info(
            'RealPath: ', repl.realpath,
            'destPath: ', destinationAssetFullPath);

        await fsp.copyFile(repl.realpath, destinationAssetFullPath);
    }
}

function generateAssetsFinalDirectory(assetBundle) {
    assert(isDefined(assetBundle) && isDefined(assetBundle.value));

    const {usePathRelativeIndex} = converterConfig;
    const asset                  = parseFile(assetBundle.value);
    const assetDir               = path.normalize(asset.dir);

    assert(isBoolean(usePathRelativeIndex));

    if (usePathRelativeIndex && isNotEmpty(assetDir)) {
        return assetDir;
    }

    const assetDirLookup        = buildAssetLookup();
    const conventionalDirectory = assetDirLookup[asset.extv2 ?? ''];
    if (isBehaved(conventionalDirectory)) {
        return conventionalDirectory;
    }

    return assetDir;
}

/*\
 * Since we are changing the destination
 * of the asset from what was originally
 * provided, all backward references of
 * the form ../../ ... has to be removed
 * so as to correctly resolve the path.
\*/
function removeBackLinks(dir) {
    return dir.replace(/(?:\.\.\/?)*/gm, '');
}

async function retrieveAssetsFromGlobalDirectory(pageSourceFile, assetsList) {
    const indexer = await getIndexer();

    const requestedAssetsResolvedPath = {};
    const [globalAssetsPath, directoryIDX] =
        await resolveGlobalAssetsPath(pageSourceFile, indexer.re);

    indexer.update({...indexer, path: globalAssetsPath});

    if (isEmpty(Object.keys(directoryIDX))) {
        return requestedAssetsResolvedPath;
    }

    const continueKey = 'x';
    for (const assetBundle of assetsList) {
        const asset                                      = assetBundle.value;
        const assetInfo                                  = parseFile(asset);
        const {realpath, version, ext, extv2, base, dir} = assetInfo;
        const providedAsset                              = directoryIDX[base];

        let fileNotFound = false;

        if (providedAsset) {
            if (Array.isArray(providedAsset)) {
                const withSimilarOrigin = filterAssetsByRelativity(
                    providedAsset, {...assetBundle, realpath: realpath});
                if (withSimilarOrigin.length === 1) {
                    console.info(
                        '\nThe file found at', withSimilarOrigin[0].realpath,
                        '\nhas been selected as a match for the file:', base);
                    requestedAssetsResolvedPath[asset] = withSimilarOrigin[0];
                } else {
                    console.info(
                        '\nThe following list of assets match',
                        '\nYour request for the file:', base,
                        '\nof base path:', dir,
                        '\nEnter the number in front to choose',
                        '\nthe file: ');
                    let counter = 0;
                    for (const file of providedAsset) {
                        console.info(
                            ++counter + '.', 'Path: ', file.realpath,
                            (isNotNull(file.version) ?
                                 '\nVersion: ' + file.version :
                                 ''));
                    }
                    if (isNotNull(version)) {
                        console.info(
                            'The file you requested requires version:',
                            version);
                    }
                    const reply = await sanitizedPrompt(strJoin(
                        'Enter your selection', '(`Enter` for default, `',
                        continueKey, '` to leave: ', ''));
                    assert(
                        Number.isFinite(+reply) ||
                        reply.toLowerCase() === continueKey);
                    if (Number.isFinite(+reply)) {
                        requestedAssetsResolvedPath[asset] =
                            providedAsset[(+reply + (+reply === 0)) - 1];
                    } else if (reply.toLowerCase() === continueKey) {
                        fileNotFound = true;
                    }
                }
            } else {
                console.info(
                    '\nThe file found at', providedAsset.realpath,
                    '\nhas been selected as a match for the file:', base,
                    isNotNull(providedAsset.version) ? ', with version:' : '',
                    providedAsset.version ?? '');
                requestedAssetsResolvedPath[asset] = providedAsset;
            }
        } else {
            fileNotFound = true;
        }

        if (!isSelfReference(pageSourceFile, base) && fileNotFound) {
            console.info(
                '\nCannot find asset by the name:', '`' + base + '`',
                'its resolution is left to you');
        }
    }

    assert(
        isNotNull(requestedAssetsResolvedPath) &&
        isBehaved(requestedAssetsResolvedPath));

    return requestedAssetsResolvedPath;
}

function filterAssetsByRelativity(providedAssets, assetDetail) {
    return providedAssets.filter(asset => {
        const {rela, realpath} = assetDetail;
        const isRelativeToRoot = realpath.startsWith('/');
        const base             = isRelativeToRoot ? mainSourceDir : rela;
        const shortpath        = removeRelativeHyperlinks(realpath);

        return path.normalize(path.join(base, shortpath)) === asset.realpath;
    });
}

function removeRelativeHyperlinks(link) {
    return link.replace(/#[^\/]+\/?/g, '');
}

async function resolveGlobalAssetsPath(pageSourceFile, excludePattern) {
    const {deduceAssetsPathFromBaseDirectory} = converterConfig;
    if (!deduceAssetsPathFromBaseDirectory) {
        console.info(
            'The following assets are loaded by this project',
            '\nand requires you to supply a path to them.',
            '\nYou can supply a directory containing all assets',
            '\nThe asset will be picked from there');
        try {
            const providedPath = await prompt(`Give directory to all assets: `);

            const pathInfo = fs.statSync(providedPath);
            if (pathInfo.isDirectory()) {
                return [
                    providedPath,
                    await indexDirectory(providedPath, excludePattern, {}, 0)
                ];
            } else
                throw 'Error: Invalid path provided';
        } catch (err) {
            console.error(err);
            return ['', requestedAssetsResolvedPath];
        }
    } else {
        const providedPath = mainSourceDir;
        return [
            providedPath,
            await indexDirectory(providedPath, excludePattern, {}, 0)
        ];
    }
}

async function indexDirectory(globalAssetsPath, excludePattern, maxDepth) {
    if (indexDirectory[globalAssetsPath]) {
        return indexDirectory[globalAssetsPath];
    }

    async function indexDirectoryImpl(globalAssetsPath, aggregations, depth) {
        if (depth >= maxDepth)
            return aggregations;

        const directoryQueue    = [];
        const directoryIterator = await fsp.readdir(globalAssetsPath);
        for (const file of directoryIterator) {
            const filePath    = path.join(globalAssetsPath, file);
            const stat        = fs.statSync(filePath);
            const isDirectory = stat.isDirectory(filePath);

            if (excludePattern.exec(filePath))
                continue;

            if (isDirectory) {
                directoryQueue.push({path: filePath, depth: depth + 1});
            } else {
                const fileInfo           = parseFile(filePath);
                const previousOccurrence = aggregations[fileInfo.base];
                Object.assign(aggregations, {
                    ...aggregations,
                    [fileInfo.base]: previousOccurrence ?
                        Array.isArray(previousOccurrence) ?
                        previousOccurrence.concat(fileInfo) :
                        [previousOccurrence, fileInfo] :
                        fileInfo
                });
            }
        }
        for (const directory of directoryQueue) {
            await indexDirectoryImpl(
                directory.path, aggregations, directory.depth);
        }

        return aggregations;
    }

    indexDirectory[globalAssetsPath] =
        await indexDirectoryImpl(globalAssetsPath, {}, 0);

    logger.info('indexDirectory -- path:', globalAssetsPath);
    logger.info('indexDirectory:', indexDirectory[globalAssetsPath]);

    return indexDirectory[globalAssetsPath];
}


function isSelfReference(reference, baseFile) {
    return path.basename(reference) === baseFile;
}

function buildExternalSource(doc, pageSourceFile, tags) {
    const relativeto = path.dirname(pageSourceFile);
    const source =
        tags.flat()
            // Remove generated scripts
            .filter(link => !link.isInline)
            .concat(
                projectDependencyInjectionTags
                    .map(tag => Array.from(doc.querySelectorAll(tag)))
                    .flat()
                    .map(
                        el => ({attribute: getAttributesRaw(el), element: el})))
            .map(link => {
                const {attribute, element} = link;
                const tag                  = attribute ?? link;
                const isHTMLElement        = isBehaved(element);

                if (tag.src) {
                    return {
                        source: 'src',
                        value: tag.src,
                        rela: relativeto,
                        isHTMLElement: isHTMLElement,
                        element: isHTMLElement ? element : link
                    };
                } else if (tag.href) {
                    return {
                        source: 'href',
                        value: tag.href,
                        rela: relativeto,
                        isHTMLElement: isHTMLElement,
                        element: isHTMLElement ? element : link
                    };
                } else if (tag.scriptName) {
                    return {
                        source: 'scriptName',
                        value: tag.scriptName,
                        rela: relativeto,
                        isHTMLElement: isHTMLElement,
                        element: isHTMLElement ? element : link
                    };
                }
            })
            .filter(
                link => link && !isAbsoluteURI(link.value) &&
                    !isSelfReference(pageSourceFile, link.value))
            // don't extract links that point to other pages yet.
            // This has to be given its own page from where it can be
            // loaded.
            .filter(
                link =>
                    !(link.isHTMLElement && link.element.nodeName === 'A' &&
                      parseFile(link.value).extv2 === 'html'));

    return source;
}

function isGeneratedScriptName(name) {
    return name?.match(/^sc-\d{4}\.[a-z]+$/);
}

async function sanitizedPrompt(message) {
    return (await rl.question(message)).trim().toLowerCase();
}

async function prompt(question) {
    return await rl.question(question);
}

var rl =
    readline.createInterface({input: process.stdin, output: process.stdout});

function parseFile(file) {
    const versionPos = file.indexOf('?');
    const realPath =
        file.slice(0, versionPos !== -1 ? versionPos : file.length);
    const otherPathInfo = path.parse(realPath);
    return {
        original: file,
        realpath: realPath,
        version: versionPos !== -1 ? isVersioned(file.slice(versionPos + 1)) ?
                                     file.slice(versionPos + 1) :
                                     null :
                                     null,
        ...otherPathInfo,
        extv2: otherPathInfo.ext.slice(1)
    };
}

function buildAssetLookup() {
    if (buildAssetLookup.assetDirLookup)
        return buildAssetLookup.assetDirLookup;

    const mimeDatabase = mimeDB();
    const assetDirLookup =
        Object.keys(mimeDatabase)
            .filter((mimeKey) => mimeDatabase[mimeKey].extensions)
            .map(
                mimeKey => mimeDatabase[mimeKey].extensions.map(
                    ext => ({[ext]: mimeKey.split('/')[0]})))
            .reduce((acc, cur) => ({...acc, ...cur.shift()}), {});

    return buildAssetLookup.assetDirLookup = assetDirLookup;
}

function mimeDB() {
    if (mimeDB.mimeDB)
        return mimeDB.mimeDB;
    return mimeDB.mimeDB = require('mime-db');
}

function isVersioned(file) {
    return file.search(/v.*?\d+(?:\.\d+)*.*/) !== -1;
}

async function initializeProjectStructure() {
    // Scheme:
    //  Setup template -- react-app
    //  Duplicate the template in ./templates/javascript/react-app
    const buildDirFullPath = fullPathOf(BUILD_DIR);
    const templateFullPath =
        fullPathOf(path.join('templates', 'javascript', 'react-app'));
    await fsp.mkdir(buildDirFullPath, {recursive: true});
    await duplicate(templateFullPath, buildDirFullPath);

    const webpackConf = 'webpack.config.js';

    const srcFullPath      = path.join(templateFullPath, 'src');
    const publicFullPath   = path.join(templateFullPath, 'public');
    const webpackFullPath  = path.join(templateFullPath, webpackConf);
    const pageFullPath     = path.join(srcFullPath, 'pages');
    const indexCssFullPath = path.join(srcFullPath, 'index.css');
    const indexJsFullPath  = path.join(srcFullPath, 'index.jsx');
    const rootHTMLFullPath = path.join(publicFullPath, 'index.html');
    const appFullPath      = path.join(srcFullPath, 'App.jsx');

    const srcBuildFullPath      = path.join(buildDirFullPath, 'src');
    const publicBuildFullPath   = path.join(buildDirFullPath, 'public');
    const webpackBuildFullPath  = path.join(buildDirFullPath, webpackConf);
    const pageBuildFullPath     = path.join(srcBuildFullPath, 'pages');
    const indexCssBuildFullPath = path.join(srcBuildFullPath, 'index.css');
    const indexJsBuildFullPath  = path.join(srcBuildFullPath, 'index.jsx');
    const rootHTMLBuildFullPath = path.join(publicBuildFullPath, 'index.html');
    const appBuildFullPath      = path.join(srcBuildFullPath, 'App.jsx');

    return {
        src: srcFullPath,
        public: publicFullPath,
        webpack: webpackFullPath,
        page: pageFullPath,
        style: indexCssFullPath,
        script: indexJsFullPath,
        root: rootHTMLFullPath,
        app: appFullPath,

        srcB: srcBuildFullPath,
        publicB: publicBuildFullPath,
        webpackB: webpackBuildFullPath,
        pageB: pageBuildFullPath,
        styleB: indexCssBuildFullPath,
        rootB: rootHTMLBuildFullPath,
        scriptB: indexJsBuildFullPath,
        appB: appBuildFullPath
    };
}

async function buildPathIgnore() {
    if (isBehaved(buildPathIgnore.pathIgnore))
        return buildPathIgnore.pathIgnore;
    const pathIgnoreFile = path.join(mainSourceDir, '.pathignore');
    if (!fs.existsSync(pathIgnoreFile))
        return buildPathIgnore.pathIgnore = null;

    const content = (await fsp.readFile(pathIgnoreFile)).toString();
    return buildPathIgnore.pathIgnore = buildRegularExpression(content);
}

function buildRegularExpression(string) {
    return string.split('\n')
        .map(line => line.trim())
        // Remove standalone comment lines
        .filter(line => isNotEmpty(line) && line[0] !== '#')
        .map(line => treat(line))
        .reduce((acc, cur) => isEmpty(acc) ? cur : acc + '|' + cur, '');
}

// Remove inline comments, escape dots,
// extend match for directory ending with `/`
function treat(line) {
    return line.replace(/#.+$/, '')
        .replace(/^\*\*|^\*/, '.*')
        .replace(/\*\*/g, '.*')
        .replace(/\.\*$/, '\\..*')
        .replace(/\/$/, '/.*')
        .replace(/\.([a-zA-Z-\/]+)/g, '\\.\$1')
        .replace(/([a-zA-Z-\/]+)\*/g, '\$1.*');
}

async function cleanOldFiles() {
    const buildDirFullPath = fullPathOf(BUILD_DIR);
    try {
        await deleteDirectory(buildDirFullPath);
    } catch (err) {
    }
}

async function removePath(path) {
    const fileInfo = fs.statSync(path);
    if (fileInfo.isFile())
        await fsp.unlink(path);
    else if (fileInfo.isDirectory())
        await deleteDirectory(path);
}

async function deleteDirectory(path) {
    await rimraf(path);
}

function extractDescription(metas) {
    const selection = metas.find(meta => meta.name === 'description');

    if (isNotDefined(selection) || isEmpty(selection.content)) {
        return metaTags.find(meta => meta.name === 'description').content;
    }

    return selection.content;
}

function extractTitle(doc, node) {
    const titleElement = doc.querySelector('title');
    const title        = titleElement?.innerHTML?.trim();
    const repl         = 'React App';
    titleElement?.remove();

    return titleElement ? title : repl;
}

function extractLinks(doc, referencePath) {
    return extractPropsImpl(doc, referencePath, 'head link');
}

function extractMetas(doc, referencePath) {
    return extractPropsImpl(doc, referencePath, 'head meta');
}

function extractPropsImpl(doc, referencePath, selector) {
    const allProps = Array.from(doc.querySelectorAll(selector));
    if (isEmpty(allProps))
        return [];
    return allProps.map(prop => getAttributesRaw(prop));
}

async function extractAllPageLinks(doc, pageSourceFile, resourcePath) {
    const links =
        Array.from(doc.querySelectorAll('a[href]'))
            .map(element => ({
                     element: element,
                     href: path.normalize(getAttributesRaw(element).href)
                 }))
            .reduce(
                (acc, link) => !acc.find(l => l.href == link.href) ?
                    acc.concat([link]) :
                    acc,
                [])
            .filter(link => isNotEmpty(link.href) && !link.href.startsWith('#'))
            .filter(
                link => !isAbsoluteURI(link.href) &&
                    !isSelfReference(mainSourceFile, link.href))
            // Match <a href='next/'></a>
            .map(link => {
                const isImplicit = lastEntry(link.href) === '/' ||
                    isEmpty(path.parse(link.href).ext);
                return isImplicit ? {
                    ...link,
                    href: removeRelativeHyperlinks(
                        path.normalize(link.href + '/index.html'))
                } :
                                    link;
            })
            .map(link => ({
                     ...link,
                     rela: path.dirname(pageSourceFile),
                     ...parseFile(link.href)
                 }))
            .filter(link => link.extv2 === 'html');

    const tinyLinks = links.map((link, index) => ({
                                    value: link.href,
                                    rela: path.dirname(pageSourceFile),
                                    recovery: index
                                }));

    const     resolvedAssetsPath =
        await retrieveAssetsFromGlobalDirectory(pageSourceFile, tinyLinks);

    const {pageB} = resourcePath;
    assert(isDefined(pageB));

    const resolvedLinks = [];
    for (const link of tinyLinks) {
        const repl = resolvedAssetsPath[link.value];
        if (isNotDefined(repl))
            continue;

        Object.assign(links[link.recovery], {
            ...links[link.recovery],
            res: {realpath: repl.realpath, dir: path.parse(link.value).dir}
        });

        resolvedLinks.push(links[link.recovery]);
    }

    return resolvedLinks;
}

async function getIndexer() {
    if (getIndexer.indexer) {
        return getIndexer.indexer;
    }

    const pathIgnore = await buildPathIgnore();

    const assetDirLookup = buildAssetLookup();
    const pathIgnoreRe   = new RegExp(pathIgnore ?? '$^');
    const searchDepth    = converterConfig.searchDepth;

    return getIndexer.indexer = {
        saved: {},
        re: pathIgnoreRe,
        depth: searchDepth,
        path: '',
        update: (indexer) => getIndexer.indexer = indexer
    };
}

function extractStyles(doc) {
    const allStyles = Array.from(doc.querySelectorAll('style'));
    if (isEmpty(allStyles))
        return '';

    const jointStyles = allStyles.map(style => style.innerHTML)
                            .reduce((acc, style) => acc + '\n' + style, '')
                            .trim();

    allStyles.forEach(style => style.remove());

    return jointStyles;
}

function escapeAllJSXQuotes(text) {
    return text.replace(/(>[^\{<>]*?)\{(.+)\}/gm, `$1{'{$2}'}`);
}

function extractAllScripts(doc) {
    const allScripts    = Array.from(doc.querySelectorAll('script'));
    const usedIDs       = new Map();
    let   uniqueCounter = randomCounter(4);

    if (isEmpty(allScripts))
        return allScripts;

    const ID    = augment('id');
    const SRC   = augment('src');
    const TYPE  = augment('type');
    const DEFER = augment('defer');

    const scripts = allScripts.map(script => {
        const attrs = getAttributes(script);
        if (!attrs[DEFER]) {
            const selection = reactAttributesLookup['defer'];
            script.setAttributeNS(null, augment(selection.react), '');
        }
        const mime = attrs[TYPE] ?? 'text/javascript';
        let   src  = attrs[SRC];
        logger.info(attrs, mime, src);

        const mimeDBEntry = mimeDB()[mime];
        assert(isBehaved(mimeDBEntry));
        const extension = mimeDBEntry?.extensions?.[0] ?? 'js';

        let id = null;
        if (!src) {
            if (!attrs[ID] || !usedIDs.get(attrs[ID])) {
                usedIDs.set(id = uniqueCounter++);
            } else if (!id) {
                id = attrs[ID];
            }
        }

        assert.notEqual(src || id, null);

        const isExternalHTML = extension === 'html';

        return {
            script: isExternalHTML ? adaptToHTML(doc, script) : script,
            isInline: !src,
            mime: mime,
            scriptName: src ?? `sc-${id}.${extension}`,
            content: script.innerHTML.trim()
        };
    });

    scripts.forEach(script => {
        script.script.remove();
    });

    return scripts;
}

function adaptToHTML(doc, element) {
    const externalResolver = doc.createElement('object');
    modifyAttributes(externalResolver, getAttributes(element));

    return externalResolver;
}

function randomCounter(nDigits) {
    return Math.floor((Math.random() + .001) * 0xdeadbeef)
        .toString(nDigits)
        .slice(0, nDigits);
}

// setAttributeNS does a case-sensitive write of
// html attributes as long as they are not built-in
// attributes in such case, it messes things up.
// Replace the augmented version of the attribute
// with the real attribute.
function refitTags(semiRawHTML) {
    return escapeAllJSXQuotes(semiRawHTML)
        .replace(new RegExp(`${REPL_ID}([a-z]+)`, 'gm'), '\$1')
        .replace(/"\{\{([^\}]+)\}\}"/g, '{{\$1}}')
        .replace(/"\{([^\}]+)\}"/g, '{\$1}');
}

function reconstructTree(node) {
    const siblings = [];
    for (const child of Array.from(node.children)) {
        siblings.push(reconstructTree(child));
    }
    modifyAttributes(node, getAttributes(node));
}

function modifyAttributes(node, attributes) {
    Object.keys(attributes).forEach(attr => {
        attr = attr.toLowerCase();
        let ns;
        if ((ns = isNamespaced(attr))) {
            const modTag    = ns[1] + ns[2][0].toUpperCase() + ns[2].slice(1);
            const attrValue = node.getAttribute(attr);
            node.setAttributeNS(null, modTag, attrValue);
        } else if (reactAttributesLookup[attr]) {
            const selection = reactAttributesLookup[attr];
            switch (selection.type) {
                case 'boolean':
                    node.setAttributeNS(
                        null, selection.react,
                        `{${Boolean(attributes[attr])}}`);
                    break;
                case 'number': {
                    const toInt = parseInt(attributes[attr]);
                    node.setAttributeNS(null, selection.react, `{${toInt}}`);
                    break;
                }
                case 'text': {
                    node.setAttributeNS(
                        null, augment(selection.react),
                        isEmpty(attributes[attr]) ? '' : attributes[attr]);
                    break;
                }
            }
            node.removeAttribute(attr);

            return;
        }
    });
}

function isNamespaced(attribute) {
    return attribute.match(/^([a-z-]+):([a-z-]+)$/);
}

function augment(attr) {
    return REPL_ID + attr;
}

function getAttributes(node) {
    const attributeNodeArray = Array.prototype.slice.call(node.attributes);

    return attributeNodeArray.reduce(function(attrs, attribute) {
        if (attribute.name !== 'style')
            attrs[attribute.name] = attribute.value;
        else {
            attrs[attribute.name] = formatStyle(attribute.value);
        }
        return attrs;
    }, {});
}

function getAttributesRaw(node) {
    const attributeNodeArray = Array.prototype.slice.call(node.attributes);
    return attributeNodeArray.reduce(
        (attrs, attribute) => ({
            ...attrs,
            [attribute.name.indexOf(REPL_ID) != -1 ?
                 attribute.name.substr(REPL_ID.length) :
                 attribute.name]: attribute.value
        }),
        {});
}

// Format inline-styles as JSX style {{}}
function formatStyle(value) {
    const formattedStyle = {};
    const stylist        = value.split(';').map(p => p.trim());
    const allStyles =
        stylist
            .map(style => {
                const div   = style.split(':').map(p => p.trim());
                const one   = div[0];
                const other = div[1];
                if (isEmpty(one) || isEmpty(other))
                    return '';
                const oneMatches = Array.from(one.matchAll(/-([a-z])/gm));
                if (isEmpty(oneMatches))
                    return `${one}: \`${other}\``;

                const jointOne = oneMatches.reduce((acc, m, i) => {
                    const section = m.input.substring(acc.start, m.index) +
                        m[1].toUpperCase();
                    acc.start = m.index + m[0].length;
                    return {...acc, str: acc.str + section};
                }, {start: 0, str: ''});

                return `${
                    jointOne.str +
                    oneMatches[oneMatches.length - 1].input.substring(
                        jointOne.start)}: \`${other}\``;
            })
            .filter(style => style.length !== 0);
    return `{{${allStyles.join(', ')}}}`;
}

function modifyLock() {
    for (const arg of arguments) {
        Object.freeze(arg);
    }
}

function isArray(any) {
    return Array.isArray(any);
}

function isString(any) {
    return typeof any === 'string';
}

function isBoolean(any) {
    return typeof any === 'boolean';
}

function isNumber(any) {
    return typeof any === 'number';
}

function isObject(any) {
    return typeof any === 'object';
}

function isRegExp(any) {
    return any instanceof RegExp;
}

function isNotEmpty(list) {
    return !isEmpty(list);
}

function isEmpty(list) {
    return list.length === 0;
}

function isBehaved(any) {
    return any !== undefined;
}

function isNotBehaved(any) {
    return !isBehaved(any);
}

function isDefined(any) {
    return isBehaved(any) && isNotNull(any);
}

function isNotDefined(any) {
    return !isDefined(any);
}

function isNull(any) {
    return any === null;
}

function isNotNull(any) {
    return !isNull(any);
}

function isAbsoluteURI(link) {
    return isURI(link);
}

function isURI(link) {
    try {
        const idx = link.indexOf('://');
        if (idx === -1) {
            new URL(link);
            return true;
        } else {
            const scheme = link.slice(0, idx);
            return supportedSchemes.includes(scheme);
        }
    } catch (error) {
        return false;
    }
}

function lastEntry(list) {
    return list[list.length - 1];
}

function fullPathOf(file) {
    return path.join(__dirname, file);
}

function closeSelfClosingTags(html) {
    for (const tag of selfClosingTags) {
        const regex = new RegExp(`<${tag}([^>]*)>`, 'gm');
        // Sort the matches so that the replacement will
        // not have to bother about shifting every other
        // match after replacement of one.
        const matches = Array.from(html.matchAll(regex)).sort((one, other) => {
            return other.index - one.index;
        });
        html          = expandMatches(tag, html, matches);
    }

    return html;
}

function expandMatches(tag, page, matches) {
    for (const match of matches) {
        const start = tag.length + match.index + 1;
        const end   = shiftByAttrs(page, start);

        if (page[end] === '>' && page[end - 1] === '/')
            return page;

        page = page.substring(0, end) + '/>' + page.substring(end + 1);
    }

    return page;
}

// Try to find the ending angular bracket
// for self-closing tags and return the position
// where it is found
function shiftByAttrs(page, off) {
    const pageLen = page.length;
    do {
        while (off < pageLen && page[off] !== '=' && page[off] !== '>')
            ++off;

        if (off >= pageLen || page[off] === '>')
            return off;

        const quotes = ['"', '\'', '`'];
        while (++off < pageLen && !quotes.includes(page[off]) &&
               page[off] !== '>')
            ;

        if (off >= pageLen || page[off] === '>')
            return off;

        const qBegin = off++;
        while (off < pageLen) {
            if (page[off - 1] !== '\\' && page[off] === page[qBegin])
                break;

            ++off;
        }

        // TODO: report error
        if (off >= pageLen || page[++off] === '>')
            return off;
    } while (off < pageLen);
}

var supportedSchemes =
    ['http', 'https', 'ftp', 'mailto', 'tel', 'data', 'file'];

var supportedFonts = ['ttf', 'otf', 'woff', 'woff2', 'eot'];

var metaTags = [
    {name: 'viewport', content: 'width=device-width, initial-scale='}, {
        name: 'theme-color',
        content: '#000000',
    },
    {name: 'description', content: 'Web site created using ReactifyHTML'}
];

var linkTags = [
    {rel: 'icon', href: 'favicon.ico'},
    {rel: 'apple-touch-icon', href: 'logo192.png'},
    {rel: 'manifest', href: 'manifest.json'}
];

var projectDependencyInjectionTags =
    ['audio', 'embed', 'iframe', 'img', 'input', 'source', 'track', 'video'];

var selfClosingTags = [
    'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input',
    'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'
];

var reactAttributesLookup = {
    'accept': {react: 'accept', type: 'text'},
    'accept-charset': {react: 'acceptCharset', type: 'text'},
    'accesskey': {react: 'accessKey', type: 'text'},
    'action': {react: 'action', type: 'text'},
    'allowfullscreen': {react: 'allowFullScreen', type: 'boolean'},
    'alt': {react: 'alt', type: 'text'},
    'async': {react: 'async', type: 'boolean'},
    'autocomplete': {react: 'autoComplete', type: 'text'},
    'autofocus': {react: 'autoFocus', type: 'boolean'},
    'autoplay': {react: 'autoPlay', type: 'boolean'},
    'capture': {react: 'capture', type: 'boolean'},
    'cellpadding': {react: 'cellPadding', type: 'text'},
    'cellspacing': {react: 'cellSpacing', type: 'text'},
    'challenge': {react: 'challenge', type: 'text'},
    'charset': {react: 'charSet', type: 'text'},
    'checked': {react: 'checked', type: 'boolean'},
    'cite': {react: 'cite', type: 'text'},
    'classid': {react: 'classID', type: 'text'},
    'class': {react: 'className', type: 'text'},
    'colspan': {react: 'colSpan', type: 'text'},
    'cols': {react: 'cols', type: 'number'},
    'content': {react: 'content', type: 'text'},
    'contenteditable': {react: 'contentEditable', type: 'boolean'},
    'contextmenu': {react: 'contextMenu', type: 'text'},
    'controls': {react: 'controls', type: 'boolean'},
    'controlslist': {react: 'controlsList', type: 'text'},
    'coords': {react: 'coords', type: 'text'},
    'crossorigin': {react: 'crossOrigin', type: 'text'},
    'data': {react: 'data', type: 'text'},
    'datetime': {react: 'dateTime', type: 'text'},
    'default': {react: 'default', type: 'boolean'},
    'defer': {react: 'defer', type: 'boolean'},
    'dir': {react: 'dir', type: 'text'},
    'disabled': {react: 'disabled', type: 'boolean'},
    'download': {react: 'download', type: 'text'},
    'draggable': {react: 'draggable', type: 'boolean'},
    'enctype': {react: 'encType', type: 'text'},
    'form': {react: 'form', type: 'text'},
    'formaction': {react: 'formAction', type: 'text'},
    'formenctype': {react: 'formEncType', type: 'text'},
    'formmethod': {react: 'formMethod', type: 'text'},
    'formnovalidate': {react: 'formNoValidate', type: 'boolean'},
    'formtarget': {react: 'formTarget', type: 'text'},
    'frameborder': {react: 'frameBorder', type: 'text'},
    'headers': {react: 'headers', type: 'text'},
    'height': {react: 'height', type: 'text'},
    'hidden': {react: 'hidden', type: 'boolean'},
    'high': {react: 'high', type: 'number'},
    'href': {react: 'href', type: 'text'},
    'hreflang': {react: 'hrefLang', type: 'text'},
    'for': {react: 'htmlFor', type: 'text'},
    'http-equiv': {react: 'httpEquiv', type: 'text'},
    'icon': {react: 'icon', type: 'text'},
    'id': {react: 'id', type: 'text'},
    'inputmode': {react: 'inputMode', type: 'text'},
    'integrity': {react: 'integrity', type: 'text'},
    'is': {react: 'is', type: 'text'},
    'keyparams': {react: 'keyParams', type: 'text'},
    'keytype': {react: 'keyType', type: 'text'},
    'kind': {react: 'kind', type: 'text'},
    'label': {react: 'label', type: 'text'},
    'lang': {react: 'lang', type: 'text'},
    'list': {react: 'list', type: 'text'},
    'loop': {react: 'loop', type: 'boolean'},
    'low': {react: 'low', type: 'number'},
    'manifest': {react: 'manifest', type: 'text'},
    'marginheight': {react: 'marginHeight', type: 'number'},
    'marginwidth': {react: 'marginWidth', type: 'number'},
    'max': {react: 'max', type: 'text'},
    'maxlength': {react: 'maxLength', type: 'number'},
    'media': {react: 'media', type: 'text'},
    'mediagroup': {react: 'mediaGroup', type: 'text'},
    'method': {react: 'method', type: 'text'},
    'min': {react: 'min', type: 'text'},
    'minlength': {react: 'minLength', type: 'number'},
    'multiple': {react: 'multiple', type: 'boolean'},
    'muted': {react: 'muted', type: 'boolean'},
    'name': {react: 'name', type: 'text'},
    'novalidate': {react: 'noValidate', type: 'boolean'},
    'nonce': {react: 'nonce', type: 'text'},
    'open': {react: 'open', type: 'boolean'},
    'optimum': {react: 'optimum', type: 'number'},
    'pattern': {react: 'pattern', type: 'text'},
    'placeholder': {react: 'placeholder', type: 'text'},
    'poster': {react: 'poster', type: 'text'},
    'preload': {react: 'preload', type: 'text'},
    'profile': {react: 'profile', type: 'text'},
    'radiogroup': {react: 'radioGroup', type: 'text'},
    'readonly': {react: 'readOnly', type: 'boolean'},
    'rel': {react: 'rel', type: 'text'},
    'required': {react: 'required', type: 'boolean'},
    'reversed': {react: 'reversed', type: 'boolean'},
    'role': {react: 'role', type: 'text'},
    'rowspan': {react: 'rowSpan', type: 'number'},
    'rows': {react: 'rows', type: 'number'},
    'sandbox': {react: 'sandbox', type: 'text'},
    'scope': {react: 'scope', type: 'text'},
    'scoped': {react: 'scoped', type: 'boolean'},
    'scrolling': {react: 'scrolling', type: 'text'},
    'seamless': {react: 'seamless', type: 'boolean'},
    'selected': {react: 'selected', type: 'boolean'},
    'shape': {react: 'shape', type: 'text'},
    'size': {react: 'size', type: 'text'},
    'sizes': {react: 'sizes', type: 'text'},
    'span': {react: 'span', type: 'number'},
    'spellcheck': {react: 'spellCheck', type: 'boolean'},
    'src': {react: 'src', type: 'text'},
    'srcdoc': {react: 'srcDoc', type: 'text'},
    'srclang': {react: 'srcLang', type: 'text'},
    'srcset': {react: 'srcSet', type: 'text'},
    'start': {react: 'start', type: 'number'},
    'step': {react: 'step', type: 'text'},
    'style': {react: 'style', type: 'text'},
    'summary': {react: 'summary', type: 'text'},
    'tabindex': {react: 'tabIndex', type: 'number'},
    'target': {react: 'target', type: 'text'},
    'title': {react: 'title', type: 'text'},
    'type': {react: 'type', type: 'text'},
    'usemap': {react: 'useMap', type: 'text'},
    'value': {react: 'value', type: 'text'},
    'width': {react: 'width', type: 'text'},
    'wmode': {react: 'wmode', type: 'text'},
    'wrap': {react: 'wrap', type: 'text'}
};

modifyLock(
    supportedFonts, metaTags, linkTags, projectDependencyInjectionTags,
    selfClosingTags, reactAttributesLookup);
