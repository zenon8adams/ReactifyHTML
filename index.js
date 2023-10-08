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
import fsExtra from 'fs-extra';
const {move: moveAll, copy: duplicate} = fsExtra;
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import readline from 'node:readline/promises';
import zlib from 'node:zlib';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {Transform} from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import jsdom from 'jsdom';
import {rimraf} from 'rimraf';
import util from 'util';
import tar from 'tar';
import yauzl from 'yauzl';
import {dirname} from 'path';
import mimeDB from 'mime-db';
import {isBinary} from 'istextorbinary';

// Import constants
import {
    supportedSchemes,
    metaTags,
    linkTags,
    projectDependencyInjectionTags,
    selfClosingTags,
    reactAttributesLookup,
    modifyLock
} from './constants.js';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const sessionID    = randomCounter(8);
const temporaryDir = path.join(os.tmpdir(), 'ReactifyHTML', sessionID);

// Logger dependencies
import winston from 'winston';
const {combine, colorize, align, printf, timestamp} = winston.format;

// Assertion dependencies
import assert from 'assert';

const REPL_ID = 'hTmL';

modifyLock(REPL_ID);

const STYLE_TAG        = 'STYLE_CONTENT';
const APP_TAG          = 'APP_CONTENT';
const HOOKS_TAG        = 'HOOKS_CONTENT';
const TITLE_TAG        = 'TITLE_CONTENT';
const META_TAG         = 'META_CONTENT';
const LINK_TAG         = 'LINK_CONTENT';
const PAGE_TAG         = 'PAGE_CONTENT';
const ROUTES_TAG       = 'ROUTES_CONTENT';
const REACT_IMPORT_TAG = 'REACT_IMPORT';

modifyLock(
    REPL_ID, STYLE_TAG, APP_TAG, HOOKS_TAG, TITLE_TAG, META_TAG, LINK_TAG,
    PAGE_TAG, ROUTES_TAG);

const STYLE_INC_TAG  = 'STYLE_INCLUDE';
const HOOKS_INC_TAG  = 'HOOKS_INCLUDE';
const SCRIPT_INC_TAG = 'SCRIPT_INCLUDE';
const ROUTES_INC_TAG = 'ROUTES_INCLUDE';
const USE_IMPORT_TAG = 'USE_IMPORT';

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
    archive: false,
    entryPoint: 'index.html',
    weakReplacement: true
};

const Decompressor = {
    Zip: Symbol('zip'),
    Gzip: Symbol('gz|tgz|tar.gz'),
};

const Magic = {
    Zip: new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
    Gzip: new Uint8Array([0x1F, 0x8B, 0x08]),
};
const MAX_MAGIC_LENGTH = 40;
const MAX_REDIRECT     = 5;
// Make it unmodifiable.
modifyLock(converterConfig, Decompressor, Magic);

// Logger setup
const logger = winston.createLogger({
    level: 'error',
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
    info(logWrapper(arguments));
};

logger.error = function() {
    error(logWrapper(arguments));
};

function logWrapper() {
    return util.format.apply(null, arguments);
}

const initialPath =
    process.argv[2] ?? path.join('examples', converterConfig.entryPoint);
const mainSourceFile = await resolveLandingPage(initialPath);
const mainSourceDir  = getRootDirectory(mainSourceFile, initialPath);

modifyLock(mainSourceFile, mainSourceDir);

/*\
 * Program starting point.
 * We try to simulate an page element
 * since we don't have access to a
 * page generator yet.
\*/
generateAllPages({
    href: mainSourceFile,
    isLanding: true,
    ...parseFile(mainSourceFile),
    dir: ''
});

async function generateAllPages(landingPage) {
    let allPageMetas = [], allStyles = '', allLinks = [], allScripts = [],
        allPages = [];

    const {useHooks} = converterConfig;
    assert(isDefined(useHooks));

    async function generateAllPagesImpl(pages, resourcePath) {
        let   pagesStream      = [].concat(pages);
        let   updatedLinks     = [];
        let   currentPageStyle = '';
        const qLookup          = {};
        const resolvedLinks    = {};
        try {
            for (let i = 0; i < pagesStream.length; ++i) {
                const page   = pagesStream[i];
                const pageID = removeAbsoluteRef(mainSourceDir, page.href);
                // Check if we have the page queued already.
                if (qLookup[pageID]) {
                    continue;
                }

                qLookup[pageID] = true;

                /*\
                 * The landing page has an href property.
                 * The path to this property is expected
                 * to be a valid path.
                 * The other extracted pages already have
                 * an href property hence, their resolved
                 * realpath property is used as their real
                 * location.
                \*/
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

                const otherPages = uniquefyPages(
                    await extractAllPageLinks(
                        doc, pageLocationFile, resourcePath),
                    pagesStream, mainSourceDir);

                await reconstructTree(root, pageLocationFile);

                // FIXME: Scripts can be loaded either via local hooks
                //  or in the global index page.
                const scripts                    = await extractAllScripts(doc);
                const                 pageStyles = extractStyles(doc);
                await                 updateMissingLinks(
                                    doc, pageLocationFile, resourcePath, currentPageLinks,
                                    scripts);

                updatedLinks = await updateLinksFromLinksContent(
                    pageLocationFile, resourcePath, currentPageLinks,
                    resolvedLinks);

                allLinks = uniquefy(allLinks, updatedLinks, 'href');

                currentPageStyle = await updateStyleLinks(
                    pageLocationFile, resourcePath, pageStyles);

                allStyles = strJoin(allStyles, currentPageStyle, '\n');

                // We have to delay the write of the transformed
                // html because we need to resolve all pages that
                // exists so as to replace their hrefs with an
                // onClick handler.
                const rawHTML = closeSelfClosingTags(
                    refitTags(dom.window.document.body.innerHTML));

                logger.info('All scripts for page:', page.realpath, scripts);
                logger.info('All styles for page:', page.realpath, pageStyles);

                const pageDescription = extractDescription(pageMetas);
                const pageName =
                    deriveNameFrom(pageID, {strip: true, suffix: 'Page'});
                /*\
                 * For the initial page, resource info (res) is not
                 * available since we are simulating it, that is it doesn't
                 * have an HTMLElement that can be attributed to it.
                 *
                 * remove the `Page` suffix from page name.
                \*/
                const pageFile = removeBackLinks(
                    path.join((page.dir ?? ''), pageName.slice(0, -4)) +
                    '.jsx');
                const pageInfo = {
                    pageID: pageID,
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

                useHooks && await addScripts(scripts, pageFile, resourcePath);

                Object.assign(page, {...page, html: rawHTML, info: pageInfo});
                allScripts   = useHooks ?
                      allScripts :
                      uniquefy(allScripts, scripts, 'scriptName');
                allPageMetas = allPageMetas.concat(pageMetas);

                // Queue newly fetched pages to the stream.
                pagesStream = pagesStream.concat(otherPages);

                allPages.push(page);

                logger.info(
                    '\n\n', '='.repeat(50), pageLocationFile, '='.repeat(50),
                    '\n\n');
            }
        } catch (err) {
            logger.error(err);
            throw err;
        }

        return allPages;
    }

    try {
        await cleanOldFiles();
        const processingParams = await initializeProjectStructure();

        const     allPages =
            await generateAllPagesImpl([landingPage], processingParams);

        logger.info('allPages: ', allPages);

        allPageMetas = uniquefyMetas(allPageMetas);

        await emplaceStyle(allStyles, processingParams);
        await emplaceMetas(allPageMetas, processingParams);
        await emplaceLinks(allLinks, processingParams);

        !useHooks && await addScripts(allScripts, null, processingParams);

        await emplaceApp(allPages, processingParams);

        await relinkPages(allPages, processingParams);

        await emplaceHTML(allPages, processingParams);

        await fixupWebpack(processingParams);

        await finalizeWriter(allPages, processingParams);

        await removeTemplates(processingParams);

    } catch (err) {
        console.error('Unable to generate project:', initialPath);
        logger.error(err);
        await cleanOldFiles();
        await cleanTemporaryFiles();
        process.exit(1);
    }

    await cleanTemporaryFiles();

    process.exit(0);
}

async function resolveLandingPage(providedPath) {
    try {
        if (isNotDefined(providedPath)) {
            throw new Error(strJoin(
                'Unable to find entry file: ', converterConfig.entryPoint, ''));
        }

        // Make sure to create temporary directory
        // if we need it.
        if (!fs.existsSync(temporaryDir)) {
            await fsp.mkdir(temporaryDir, {recursive: true});
        }

        // The provided path is a directory, we can try to find
        // an index file from the path.
        if (fs.existsSync(providedPath) &&
            fs.statSync(providedPath).isDirectory()) {
            return await resolveLandingPage(await findIndexFile(providedPath));
        }

        if (isAbsoluteURI(providedPath)) {
            return await downloadProject(providedPath);
        }


        const functions = {
            [Decompressor.Zip]: unzipProject,
            [Decompressor.Gzip]: unGzipProject
        };

        // Build up an extension lookup for all registered archive file types.
        const associations =
            Object.values(Decompressor)
                .map(
                    dc => dc.toString()
                              .replace(/^.+\((.+)\)$/, '$1')
                              .split('|')
                              .map(ext => ({[ext]: functions[dc]})))
                .flat()
                // Sort the listings by extension length in ascending order
                // so that longer extension names are matched first.
                .sort((one, other) => {
                    const oneLen   = Object.keys(one)[0].length;
                    const otherLen = Object.keys(other)[0].length;
                    return otherLen < oneLen ? -1 : oneLen === otherLen ? 0 : 1;
                })
                .reduce((acc, cur) => ({...acc, ...cur}), {});

        const {extv2, base} = parseFile(providedPath);
        if (extv2 === 'html') {
            return providedPath;
        }

        // Match the longest extension name that can be derived from the
        // basename
        const ext =
            Object.keys(associations).find(ex => base.lastIndexOf(ex) !== -1);
        let selector = associations[ext];

        if (isNotDefined(selector)) {
            selector = await tryDecodeFromMagic(providedPath, functions);
        }

        if (selector) {
            const dir = await selector(providedPath, ext);
            if (isNotDefined(dir)) {
                throw new Error(strJoin(
                    'Could not find', converterConfig.entryPoint,
                    'file in the provided path', providedPath, ' '));
            }
            return dir;
        }
    } catch (err) {
        console.error(err.message);
        logger.error(err);
        process.exit(1);
    }

    console.error('Unable to resolve provided path:', providedPath);
    process.exit(1);
}

async function tryDecodeFromMagic(providedPath, lookup) {
    const [size, filePiece] = await readFile(providedPath, MAX_MAGIC_LENGTH);
    for (const type of Object.keys(Magic)) {
        const magic = Magic[type];
        if (size < magic.length) {
            continue;
        }
        const sameSizedBuf = filePiece.slice(0, magic.length);
        if (Buffer.from(magic).equals(sameSizedBuf)) {
            return lookup[Decompressor[type]];
        }
    }
}

async function readFile(filepath, maxLength) {
    return new Promise(async (resolve, reject) => {
        fs.open(filepath, 'r', (o_err, fd) => {
            if (o_err) {
                reject(o_err);
                return;
            }

            const buffer = new Uint8Array(maxLength);
            fs.read(fd, buffer, 0, maxLength, 0, (r_err, n_read, buffer) => {
                if (r_err) {
                    reject(r_err);
                    return;
                }
                resolve([n_read, buffer]);
            });
        });
    });
}

function getRootDirectory(file, startingPath) {
    const dir = path.dirname(file);
    if (!isAbsoluteURI(startingPath) &&
        fs.statSync(startingPath).isDirectory()) {
        /*
         * Check if the initial supplied path
         * is parent of the point where the file is found.
         */
        if (path.relative(dir, startingPath).startsWith('..')) {
            return startingPath;
        }
    }
    return dir;
}

async function unzipProject(providedPath) {
    return await decompressZipOrGzipImpl(providedPath, Decompressor.Zip);
}

async function unGzipProject(providedPath) {
    return await decompressZipOrGzipImpl(providedPath, Decompressor.Gzip);
}

async function decompressZipOrGzipImpl(archivePath, decompressor) {
    assert(
        decompressor === Decompressor.Zip ||
        decompressor === Decompressor.Gzip);

    const decomps  = Object.values(Decompressor);
    const rootPath = await[decompressZipImpl, decompressGzipImpl].at(
        decomps.indexOf(decompressor))(archivePath);

    logger.info('rootPath:', rootPath);
    let filePath = path.join(temporaryDir, rootPath);

    const info = fs.statSync(filePath);
    if (info.isDirectory()) {
        return findIndexFile(filePath);
    } else {
        // For nested archives such as .tar.gz
        // or previously resolved path cyling
        // back to this point.
        return await resolveLandingPage(filePath);
    }
}

async function decompressGzipImpl(archivePath) {
    let seenRootDir = false;
    let rootDir     = '';
    return new Promise(async (resolve, reject) => {
        const readStream  = fs.createReadStream(archivePath);
        const unzipStream = zlib.createGunzip();
        unzipStream.pipe(tar.extract({
            cwd: temporaryDir,
            onentry: (entry) => {
                [rootDir, seenRootDir] =
                    checkIfActuallyRoot(rootDir, entry.path);
            }
        }));

        readStream.pipe(unzipStream);
        readStream.on('error', reject);
        unzipStream.on('error', reject);
        unzipStream.on('finish', () => resolve(seenRootDir ? rootDir : './'));
    })
};

async function decompressZipImpl(archivePath) {
    let handleCount = 0;
    let rootDir     = '';
    let seenRootDir = false;
    return new Promise((resolve, reject) => {
        yauzl.open(archivePath, {lazyEntries: true}, async (err, zipfile) => {
            if (err) {
                reject(err);
                return;
            }
            // track when we've closed all our file handles
            function incrementHandleCount() {
                handleCount++;
            }
            function decrementHandleCount() {
                handleCount--;
                if (handleCount === 0) {
                    resolve(seenRootDir ? rootDir : './');
                }
            }

            incrementHandleCount();
            zipfile.on('close', function() {
                decrementHandleCount();
            });

            zipfile.readEntry();
            zipfile.on('entry', async (entry) => {
                const destPath = path.join(temporaryDir, entry.fileName);
                [rootDir, seenRootDir] =
                    checkIfActuallyRoot(rootDir, entry.fileName);

                logger.info('Processing:', destPath);
                if (/\/$/.test(entry.fileName)) {
                    // directory file names end with '/'
                    await fsp.mkdir(destPath, {recursive: true});
                    zipfile.readEntry();
                } else {
                    // ensure parent directory exists
                    if (!fs.existsSync(path.dirname(destPath))) {
                        await fsp.mkdir(path.dirname(destPath));
                    }
                    zipfile.openReadStream(entry, function(err, readStream) {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const filter      = new Transform();
                        filter._transform = function(chunk, encoding, cb) {
                            cb(null, chunk);
                        };
                        filter._flush = function(cb) {
                            cb();
                            zipfile.readEntry();
                        };

                        // pump file contents
                        const writeStream = fs.createWriteStream(destPath);
                        incrementHandleCount();
                        writeStream.on('close', decrementHandleCount);
                        readStream.pipe(filter).pipe(writeStream);
                    });
                }
            });
        });
    });
}

/*\
 * From continuously calling this function
 * with stream of paths, it returns if
 * the list of all files passed have the
 * same root path. It selects the first
 * provided path as the supposed root path
 * if it is not provided.
 *
 * It is useful when decoding compressed
 * files. The first read path from the
 * compressed files will be the root
 * directory if it exists.
\*/
function checkIfActuallyRoot(maybeRootDir, readPath) {
    if (isEmpty(maybeRootDir)) {
        maybeRootDir = readPath;
    }

    if (path.relative(maybeRootDir, readPath).startsWith('..')) {
        return [maybeRootDir, false];
    }

    return [maybeRootDir, true];
}

async function findIndexFile(providedPath) {
    async function findIndexFileImpl(initialPath) {
        const directoryQueue    = [];
        const directoryIterator = await fsp.readdir(initialPath);
        for (const file of directoryIterator) {
            const filePath    = path.join(initialPath, file);
            const stat        = fs.statSync(filePath);
            const isDirectory = stat.isDirectory(filePath);

            if (file === converterConfig.entryPoint) {
                return filePath;
            } else if (isDirectory) {
                directoryQueue.push(filePath);
            }
        }
        /*\
         * Convert a depth-first-search into a
         * breadth-first search by keeping the
         * next nodes to explore in a queue.
        \*/
        for (const directory of directoryQueue) {
            const file = await findIndexFileImpl(directory);
            if (isDefined(file)) {
                return file;
            }
        }
    }

    const file = await findIndexFileImpl(providedPath);

    return file;
}

async function downloadProject(url, original, redirectDepth) {
    const {base} = path.parse(original ?? url);
    const scheme = url.slice(0, url.indexOf('://'));
    assert(scheme === 'http' || scheme === 'https');
    const protocol     = [http, https].at(scheme === 'https');
    const downloadPath = path.join(temporaryDir, base);
    return new Promise((resolve, reject) => {
               protocol.get(url, (response) => {
                   const {statusCode} = response;
                   // We have been redirected
                   if (statusCode === 302) {
                       resolve({
                           redirectUrl: response.headers.location,
                           depth: redirectDepth ?? 1
                       });
                       response.resume();
                       return;
                   } else if (statusCode !== 200) {
                       reject(new Error(strJoin(
                           `Request Failed`, `Status Code: ${statusCode}`,
                           '\n')));
                       response.resume();
                       return;
                   }

                   const stream = fs.createWriteStream(downloadPath);
                   response.pipe(stream);
                   stream.on('finish', () => {
                       stream.close();
                       resolve({path: downloadPath});
                   });
               });
           })
        .then(/* If we are redirected, recurse with the new path */
              (next) => {
                  if (next.redirectUrl && next.depth <= MAX_REDIRECT) {
                      return downloadProject(
                          next.redirectUrl, url, next.depth + 1);
                  } else if (next.depth > MAX_REDIRECT) {
                      return Promise.reject(
                          new Error('Maxium redirect reached'));
                  } else {
                      return resolveLandingPage(next.path);
                  }
              });
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

async function finalizeWriter(pages, resourcePath) {
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
        await emplaceImpl(REACT_IMPORT_TAG, pageFullPath, pageFullPath, '');
        await emplaceImpl(USE_IMPORT_TAG, pageFullPath, pageFullPath, '');
    }

    await emplaceImpl(SCRIPT_INC_TAG, rootB, rootB, '');
    await emplaceImpl(ROOT_ATTR_TAG, rootB, rootB, ' lang="en"');
    await emplaceImpl(ENV_PRE_TAG, webpackB, webpackB, '');

    const favicon         = linkTags.filter(link => link.rel === 'icon')[0];
    const publicBaseName  = path.basename(publicB);
    const faviconTemplate = useOSIndependentPath(
        buildPathTemplateFrom(path.join(publicBaseName, favicon.href)));

    await emplaceImpl(FAVICON_DIR_TAG, webpackB, webpackB, faviconTemplate);

    const assetIsPresent = fs.existsSync(path.join(publicB, ASSETS_DIR));
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
                        const attrs = getAttributesRaw(script.script);
                        Object.assign(
                            attrs, {[augment('type')]: script.mime, ...attrs});
                        const jAttrs = refitTags(joinAttrs(
                            attrs,
                            {src: useOSIndependentPath(script.scriptName)}));
                        return acc + `<script ${jAttrs}></script>` +
                            '\n\t';
                    } else {
                        return acc + '<script src="/' +
                            useOSIndependentPath(path.join(
                                script.shortPath, script.scriptName)) +
                            '" type="' + script.mime + '" defer></script>\n\t';
                    }
                },
                '\n\t')
            .trimEnd();

    const {rootB} = resourcePath;
    assert(isDefined(rootB));

    await emplaceImpl(SCRIPT_INC_TAG, rootB, rootB, scriptsList);
    await removeHooks('*', resourcePath);
}

function deriveNameFrom(filePath, opts) {
    const {strip, suffix} = opts ?? {};
    const base            = strip ? path.basename(filePath) : filePath;
    const {ext}           = path.parse(base);
    const name = base.slice(0, isEmpty(ext) ? base.length : -ext.length);
    let   page = Array.from(name.matchAll(/([a-zA-Z0-9]+)/g))
                   .reduce((acc, m) => acc + capitalize(m[1]), '');

    if (suffix && !page.match(new RegExp(`${suffix}$`, 'i'))) {
        page += suffix;
    }

    return page.match(/^[0-9]/) ? 'P_' + page : page;
}

function capitalize(str) {
    if (isEmpty(str)) {
        return str;
    }
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

function uniquefyMetas(metas) {
    const metaValues =
        metas
            .map((meta, idx) => ({
                     search:
                         Object.values(meta).map(v => v.toLowerCase()).sort(),
                     recovery: idx
                 }))
            .sort((one, other) => {
                const isLess    = one.search < other.search;
                const isGreater = one.search > other.search;
                return isLess ? -1 : isGreater ? 1 : 0;
            });

    const uniqueValues = [];
    let   active       = metaValues[0];
    for (let i = 1; i < metaValues.length; ++i) {
        const other = metaValues[i];
        if (!isSuperSetOf(other.search, active.search)) {
            uniqueValues.push(active);
        }
        active = other;
    }

    if (isNotEmpty(uniqueValues))
        uniqueValues.push(active);

    return uniqueValues.map(v => metas[v.recovery]);
}

// Requires arguments to be sorted.
function isSuperSetOf(standard, given) {
    let j = 0;
    for (let i = 0; i < standard.length && j < given.length; ++i) {
        if (standard[i] === given[j]) {
            ++j;
        }
    }

    return j == given.length;
}

function uniquefyPages(newPages, allPages, mainDir) {
    return newPages.filter(
        oneItem => !allPages.find(
            otherItem =>
                removeAbsoluteRef(
                    mainDir, otherItem?.res?.realpath ?? otherItem.href) ===
                removeAbsoluteRef(
                    mainDir, oneItem?.res?.realpath ?? oneItem.href)));
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

function removeAbsoluteRef(mainDir, href) {
    const {dir} = path.parse(href);

    const fullPath = isEmpty(dir) ? path.join(mainDir, href) : href;

    return removeBackLinks(path.relative(mainDir, fullPath));
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

    const scriptsList  = useOSIndependentPath(scripts.reduce(
         (acc, script) => acc + '\'' + script.scriptName + '\'' +
             ',\n\t',
         '\n\t'));
    const hooksPath    = path.join(srcB, 'hooks/useScript');
    const pageFullPath = path.join(pageB, pagePath);
    const pageFullDir  = path.dirname(pageFullPath);
    const relHookIncl =
        useOSIndependentPath(path.relative(pageFullDir, hooksPath));
    const hook =
        `\n\tconst [loadedScripts, error] = useScript([${scriptsList}]);`;
    const include = `\nimport useScript from './${relHookIncl}';`;

    await emplaceImpl(HOOKS_TAG, pageFullPath, pageFullPath, hook);
    await emplaceImpl(HOOKS_INC_TAG, pageFullPath, pageFullPath, include);
}

async function removeHooks(hooks, resourcePath) {
    assert(isDefined(resourcePath.srcB));
    assert(hooks === '*' || Array.isArray(hooks));

    const removeAllHooks = !Array.isArray(hooks);
    const hooksFullPath  = path.join(resourcePath.srcB, HOOKS_DIR);
    if (removeAllHooks) {
        await deleteDirectory(hooksFullPath);
    } else {
        hooks.forEach(async (hook) => {
            const hookFile = hook + '.jsx';
            await deleteFilesMatch(hooksFullPath, hookFile);
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
                /*
                 * Delete the `original` tag so that it won't
                 * reflect as an attribute.
                 */
                delete current.original;
                const joint = useOSIndependentPath(joinAttrs(current));
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

    if (path.extname(oldFavicon.href) !== path.extname(newFavicon.href)) {
        const oldExt = path.extname(oldFavicon.href);
        const newExt = path.extname(newFavicon.href);
        Object.assign(newFavicon, {
            ...newFavicon,
            href: newFavicon.href.slice(0, -newExt.length).concat(oldExt)
        });
    }

    const oldFaviconFile = path.join(publicB, oldFavicon.href);
    const newFaviconFile = path.join(publicB, newFavicon.href);
    try {
        if (fs.existsSync(oldFaviconFile)) {
            await fsp.copyFile(oldFaviconFile, newFaviconFile);
            const publicBaseName = path.basename(publicB);

            const newFaviconTemplate = buildPathTemplateFrom(
                path.join(publicBaseName, newFavicon.href));
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

    const styleInclude = `\nimport './${path.basename(resourcePath.style)}';`;
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

async function relinkPages(pages, resourcePath) {
    const {pageB} = resourcePath;
    assert(isDefined(pageB));

    // create a lookup of all page and its corresponding
    // route.
    const routeMap = new Map();
    pages.forEach(
        page => routeMap.set(
            page.isLanding ? page.href : path.join(page.rela, page.href),
            page.route));

    const re = new RegExp(
        '<a[^]+?href[^=]*=[^`\'"]*((?:"[^"\\\\]*' +
            '(?:\\\\.[^"\\\\]*)*"|\'[^\'\\\\]*(?:\\\\.' +
            '[^\'\\\\]*)*\'|`[^`\\\\]*(?:\\\\.[^`\\\\]*)*`))',
        'gm');

    const empty_re = new RegExp('<a[^]+?href[^=]*=(""|\'\'|``)', 'gm');
    for (const page of pages) {
        const {html} = page;
        assert(html);

        /*\
         * Anchor attributes of the form href="" resolve to homepage.
         * We have to prevent default on this kind of links to prevent
         * the page from reloading.
        \*/
        const allEmptyLinks =
            Array.from(html.matchAll(empty_re)).sort(sortIndexDesc);

        Object.assign(
            page, {...page, html: fixEmptyLinks(html, page, allEmptyLinks)});

        const allLinks = Array.from(page.html.matchAll(re))
                             .sort(sortIndexDesc)
                             .map(m => {
                                 m[1] = path.normalize(
                                     removeRelativeHyperlinks(unQuote(m[1])));
                                 return m;
                             })
                             .filter(
                                 m => !isAbsoluteURI(m[1]) && m[1] !== '.' &&
                                     !!getMatchingRoute(page, m[1], routeMap));

        Object.assign(page, {
            ...page,
            html: fixAnchorRoutes(page.html, page, allLinks, routeMap)
        });

        if (isEmpty(allLinks)) {
            continue;
        }

        const pageFullPath = path.join(pageB, page.info.path);
        const importDecl   = strJoin(
              `import { useNavigate } from "react-router-dom";`,
              `@{${REACT_IMPORT_TAG}}`, '\n');
        const navDecl = `\nconst navigate = useNavigate();`;
        const navFun  = strJoin(
             `const navigateTo = (event, page) => {`, `event.preventDefault();`,
             `navigate(page);`, `}`, '\t\n');
        const useImportDecl =
            strJoin(navDecl, navFun, `@{${USE_IMPORT_TAG}}`, '\n');

        await emplaceImpl(
            REACT_IMPORT_TAG, pageFullPath, pageFullPath, importDecl);
        await emplaceImpl(
            USE_IMPORT_TAG, pageFullPath, pageFullPath, useImportDecl);
    }
}

function getMatchingRoute(page, match, routeMap) {
    if (page.isLanding) {
        const fullp = path.join(path.dirname(page.href), match);
        return routeMap.get(fullp);
    }

    const fullp = path.join(page.rela, path.dirname(page.href), match);
    return routeMap.get(fullp);
}

function fixAnchorRoutes(html, page, matches, routeMap) {
    const isWeakPolicy = converterConfig.weakReplacement;
    const hKey         = 'href=';
    for (const match of matches) {
        const ihref = html.slice(match.index).indexOf(hKey);
        const start = match.index + ihref + hKey.length;
        const end   = match.index + match[0].length;
        const route = getMatchingRoute(page, match[1], routeMap);
        const link  = isWeakPolicy ? match[1] : 'javascript:void(0);';
        const repl  = `"${link}" onClick={(e) => navigateTo(e, '${route}')}`;

        html = html.substring(0, start) + repl + html.substring(end);
    }

    return html;
}

function fixEmptyLinks(html, page, matches) {
    for (const match of matches) {
        const start =
            match.index + match[0].length - 2 /* Subtract the empty quote */;
        const end = match.index + match[0].length;
        const repl =
            '"javascript:void(0);" onClick={(e) => e.preventDefault()}';

        html = html.substring(0, start) + repl + html.substring(end);
    }

    return html;
}

/*
 * Setup navigation for the pages.
 */
async function emplaceApp(pages, resourcePath) {
    const {appB, pageB} = resourcePath;
    assert(isArray(pages));
    assert(isString(appB));

    let allPageCases = '';
    let allRoutes    = '';
    let routesIncl   = '';
    for (const page of pages) {
        const {name, title, description} = page.info;
        const [pageUrl, realname]        = getPageRoute(page);

        const pageIncl = useOSIndependentPath('./pages/' + realname);
        const declName = deriveNameFrom(realname, {suffix: 'Page'});

        allPageCases = strJoin(
            allPageCases, `case '${pageUrl}':\n`, `\ttitle = '${title}';\n`,
            `\tmetaDescription = '${description}';\n`, `\tbreak;\n`, '\t');

        allRoutes = strJoin(
            allRoutes, `<Route`, `path="${pageUrl}"`,
            `element={<${declName} />} />\n\t\t`, ' ');


        routesIncl = routesIncl + `\nimport ${declName} from '${pageIncl}';`;

        Object.assign(page, {...page, route: pageUrl});
    }

    await emplaceImpl(PAGE_INFO_TAG, appB, appB, allPageCases.trimRight());
    await emplaceImpl(ROUTES_TAG, appB, appB, allRoutes.trimRight());
    await emplaceImpl(ROUTES_INC_TAG, appB, appB, routesIncl.trimRight());
}

function getPageRoute(page) {
    const realname =
        page.info.path.slice(0, -path.extname(page.info.path).length);
    const pageUrl = page.isLanding ?
        '/' :
        useOSIndependentPath(path.normalize('/' + realname.toLowerCase()));

    return [pageUrl, realname];
}

async function emplaceHTML(pages, resourcePath) {
    const {pageB} = resourcePath;
    assert(isDefined(pageB));

    for (const page of pages) {
        const {info, html} = page;
        const pageFullPath = path.join(pageB, info.path);

        await emplaceImpl(
            PAGE_TAG, pageFullPath, pageFullPath, useJSXStyleComments(html));
        await emplaceImpl(PAGE_NAME_TAG, pageFullPath, pageFullPath, info.name);
    }
}

function useJSXStyleComments(rawHTML) {
    assert(isDefined(rawHTML) && isString(rawHTML));

    /*
     * Add padding to the new comment in case the
     * contents of the comment starts with a `/`.
     */
    return editComment(
               rawHTML,
               Array.from(rawHTML.matchAll(/<!--([^]*?)-->/gm))
                   .sort(sortIndexDesc))
        .replace(/(\/\*[^\/]*?(?<=\*)\/(?!\}))/gm, '{ $1 }');
}

function editComment(rawHTML, matches) {
    for (const match of matches) {
        const start = match.index + 4;               /* <!-- */
        const end   = match.index + match[0].length; /* --> */
        const repl  = strJoin(
             '{/* ', rawHTML.slice(start, end - 3).replace(/\*\//gm, '*\\/'),
             ' */}', '');
        rawHTML =
            rawHTML.substring(0, match.index) + repl + rawHTML.substring(end);
    }

    return rawHTML;
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
    pageSourceFile, resourcePath, links, resolvedLinks) {
    assert(isString(pageSourceFile));

    const {publicB} = resourcePath;
    assert(isDefined(publicB));

    for (const link of links) {
        if (isAbsoluteURI(link.href))
            continue;

        const linkFullPath = path.join(publicB, link.href);
        if (!fs.existsSync(linkFullPath) || isBinary(linkFullPath))
            continue;

        /*\
         * Don't bloat the resolvedLinks cache,
         * we won't add know binary files and
         * absolute URLs to it.
        \*/
        if (resolvedLinks[link.href]) {
            continue;
        }

        Object.assign(resolvedLinks, {...resolvedLinks, [link.href]: true});

        try {
            const     content = (await fsp.readFile(linkFullPath)).toString();
            const     updatedContent =
                await updateStyleLinks(link.original, resourcePath, content);
            await     fsp.writeFile(linkFullPath, updatedContent);

        } catch (err) {
            console.error('Error:', err);
            logger.error(err);
        };
    }

    return links;
}

async function updateStyleLinks(pageSourceFile, resourcePath, style) {
    const fixables =
        Array
            .from(style.matchAll(
                /@import[^]+?(?:url)?['`"]([^`'"]+)[`'"]|url\s*\(([^\)]+)\)/gm))
            .sort(sortIndexDesc)
            .filter(link => {
                return !isAbsoluteURI(unQuote(link[1] ?? link[2]));
            });

    logger.info('Fixables:', fixables);

    if (isEmpty(fixables)) {
        return style;
    }

    return (await resolveEmbeddedAssets(
                style, fixables, pageSourceFile, resourcePath,
                (file) => `url("/${file}")`))
        .trim();
}

async function updateInlineStyleAssets(source, pageSourceFile) {
    if (isNotDefined(pageSourceFile)) {
        return source;
    }

    const resourcePath = await initializeProjectStructure();
    const urls         = Array.from(source.matchAll(/url\s*\(([^\)]+)\)/gm))
                     .sort(sortIndexDesc)
                     .filter(link => !isAbsoluteURI(link[1]));
    if (isEmpty(urls)) {
        return source;
    }

    return await resolveEmbeddedAssets(
        source, urls, pageSourceFile, resourcePath,
        (link) => `url('/${link}')`);
}

async function resolveEmbeddedAssets(
    raw, fixables, pageSourceFile, resourcePath, format_cb) {
    assert(isDefined(format_cb) && isFunction(format_cb));

    const     links = fixables.map((link, index) => ({
                                       value: unQuote(link[1] ?? link[2]),
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
        const assetFile      = useOSIndependentPath(
                 path.join(assetsRealPath, path.basename(link.value)));
        const recInfo = fixables[link.recovery];
        raw           = raw.substring(0, recInfo.index) + format_cb(assetFile) +
            raw.substring(recInfo.index + recInfo[0].length);
    }

    return raw;
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

        const augmentedPath = '/' + path.join(ASSETS_DIR, finalDir, repl.base);
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

        if (!fs.existsSync(destinationAssetFullPath)) {
            await fsp.copyFile(repl.realpath, destinationAssetFullPath);
        }
    }
}

function generateAssetsFinalDirectory(assetBundle) {
    assert(isDefined(assetBundle) && isDefined(assetBundle.value));

    const {usePathRelativeIndex} = converterConfig;
    const asset                  = parseFile(assetBundle.value);
    let   assetDir               = removeBackLinks(path.normalize(asset.dir));

    if (assetDir.startsWith(ASSETS_DIR))
        assetDir = assetDir.slice(ASSETS_DIR.length);

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

function useOSIndependentPath(p) {
    return p.replace(new RegExp(`${path.sep}${path.sep}+`, 'g'), '/')
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
        retrieveAssetsFromGlobalDirectory.globalAssetsPath ?
        [retrieveAssetsFromGlobalDirectory.globalAssetsPath, indexer.saved] :
        await resolveGlobalAssetsPath(pageSourceFile, indexer.re);

    indexer.update({saved: directoryIDX, path: globalAssetsPath});

    if (isEmpty(Object.keys(directoryIDX))) {
        return requestedAssetsResolvedPath;
    }


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
                    const selected = withSimilarOrigin[0];
                    console.info(
                        '\nThe file found at', selected.realpath,
                        '\nhas been selected as a match for the file:', base,
                        isNotNull(selected.version) ? ', with version:' : '',
                        selected.version ?? '');
                    requestedAssetsResolvedPath[asset] = withSimilarOrigin[0];
                } else {
                    fileNotFound = true;
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

        if (/*!isSelfReference(pageSourceFile, base) && */ fileNotFound) {
            console.info(
                '\nCannot find asset by the name:', '`' + base + '`',
                'its resolution is left to you');
        }
    }

    assert(
        isNotNull(requestedAssetsResolvedPath) &&
        isBehaved(requestedAssetsResolvedPath));

    // Save the global assets path so that if we only ask from the
    // user once.
    retrieveAssetsFromGlobalDirectory.globalAssetsPath = globalAssetsPath;

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

function numberOfComponents(filepath) {
    return path.normalize(filepath)
        .split(path.sep)
        .filter(p => isNotEmpty(p))
        .length;
}

function numberOfBacklinkPrefix(filepath) {
    let pos = 0, brefs = 0;
    while ((pos = nextOf(pos, filepath, path.sep)) != -1) {
        if (pos >= 2 && filepath[pos - 1] == '.' && filePath[pos - 2] == '.') {
            ++brefs;
        } else {
            break;
        }
    }

    return brefs;
}

function removeRelativeHyperlinks(link) {
    return link.replace(/#[^\/]*\/?/g, '');
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

            if (fs.existsSync(providedPath) &&
                fs.statSync(providedPath).isDirectory()) {
                const pathIgnoreFile = path.join(providedPath, '.pathignore');
                const indexer        = await getIndexer();
                if (fs.existsSync(pathIgnoreFile)) {
                    indexer.update({re: await buildPathIgnore(providedPath)});
                }
                return [
                    providedPath,
                    await indexDirectory(providedPath, indexer.re, {}, 0)
                ];
            } else {
                throw new Error('Error: Invalid path provided');
            }
        } catch (err) {
            console.error(err.message);
            logger.error(err);
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
    const originalPath = globalAssetsPath;
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

            process.stdout.write(
                '\x1B[2KIndexing... ' + path.relative(originalPath, filePath) +
                '\r');
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
                link => link && !isAbsoluteURI(link.value)/* &&
                    !isSelfReference(pageSourceFile, link.value)*/)
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
    return !!name?.match(/^sc-\d{4}\.[a-z]+$/);
}

async function sanitizedPrompt(message) {
    return (await prompt(message)).trim().toLowerCase();
}

async function prompt(question) {
    return await rl.question(question);
}

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

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

    const mimeDatabase = mimeDB;
    const assetDirLookup =
        Object.keys(mimeDatabase)
            .filter((mimeKey) => mimeDatabase[mimeKey].extensions)
            .map(
                mimeKey => mimeDatabase[mimeKey].extensions.map(
                    ext => ({[ext]: mimeKey.split('/')[0]})))
            .reduce((acc, cur) => ({...acc, ...cur.shift()}), {});

    return buildAssetLookup.assetDirLookup = assetDirLookup;
}

function isVersioned(file) {
    return file.search(/v.*?\d+(?:\.\d+)*.*/) !== -1;
}

async function initializeProjectStructure() {
    if (initializeProjectStructure.resourcePath) {
        return initializeProjectStructure.resourcePath;
    }
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

    return initializeProjectStructure.resourcePath = {
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

async function buildPathIgnore(origin) {
    const dir = origin ?? mainSourceDir;
    if (isDefined(buildPathIgnore.pathIgnore) &&
        isDefined(buildPathIgnore.pathIgnore[origin])) {
        return buildPathIgnore.pathIgnore[dir];
    } else {
        buildPathIgnore.pathIgnore = {};
    }

    const pathIgnoreFile = path.join(dir, '.pathignore');
    if (!fs.existsSync(pathIgnoreFile)) {
        return buildPathIgnore.pathIgnore[dir] = new RegExp('$^');
    }

    const content = (await fsp.readFile(pathIgnoreFile)).toString();
    const re      = new RegExp(buildRegularExpression(content));
    return buildPathIgnore.pathIgnore[dir] = re;
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

async function cleanTemporaryFiles() {
    try {
        await deleteDirectory(temporaryDir);
        await fsp.rmdir(path);
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
    return extractPropsImpl(doc, referencePath, 'head link')
        /*
         * Add the original path where the link is found
         * as we might have to access the resource to
         * fix missing links in it.
         */
        .map(
            link => ({
                ...link,
                original: path.normalize(strJoin(referencePath, link.href, '/'))
            }));
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
            .map(
                element =>
                    ({href: path.normalize(getAttributesRaw(element).href)}))
            .reduce(
                (acc, link) => !acc.find(l => l.href == link.href) ?
                    acc.concat([link]) :
                    acc,
                [])
            .filter(link => isNotEmpty(link.href) && !link.href.startsWith('#'))
            .filter(
                link => !isAbsoluteURI(link.href)/* &&
                    !isSelfReference(mainSourceFile, link.href)*/)
            // Match <a href='next/'></a>
            .map(link => {
                // Implicit references such as: /docs/api
                // refers to the index.html file found
                // in that directory.
                // i.e /docs/api/index.html
                const isImplicit = isImplicitReference(link.href);
                return isImplicit ? {
                    ...link,
                    isImplicit: true,
                    href: augmentImplicitReference(link.href) 
                } : link;
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

function stripQueryAndFragment(link) {
    // URI = scheme ":" ["//" authority] path ["?" query] ["#" fragment]
    const query    = link.indexOf('?');
    const fragment = link.indexOf('#');
    const base     = query !== -1 ? link.slice(0, query) :
            fragment !== -1       ? link.slice(0, fragment) :
                                    link;
    return [
        base,
        query !== -1        ? link.slice(query) :
            fragment !== -1 ? link.slice(fragment) :
                              null
    ];
}

function isImplicitReference(link) {
    const [base, queryAndFragment] = stripQueryAndFragment(link);
    return base.endsWith('/') || isEmpty(path.parse(base).ext);
}

function augmentImplicitReference(link) {
    const [base, queryAndFragment] = stripQueryAndFragment(link);
    return path.normalize(base + '/index.html') + (queryAndFragment ?? '');
}

async function getIndexer() {
    if (getIndexer.indexer) {
        return getIndexer.indexer;
    }

    const assetDirLookup                   = buildAssetLookup();
    const pathIgnoreRe                     = await buildPathIgnore();
    const                      searchDepth = converterConfig.searchDepth;

    return getIndexer.indexer = {
        saved: {},
        re: pathIgnoreRe,
        depth: searchDepth,
        path: '',
        update: function() {
            return Object.assign(this, {
                ...this,
                ...Array.from(arguments).reduce(
                    (acc, arg) => ({...acc, ...arg}), {})
            });
        }
    };
}

function extractStyles(doc) {
    const allStyles = Array.from(doc.querySelectorAll('style'));
    if (isEmpty(allStyles)) {
        return '';
    }

    const jointStyles = allStyles.map(style => style.innerHTML)
                            .reduce((acc, style) => acc + '\n' + style, '')
                            .trim();

    allStyles.forEach(style => style.remove());

    return jointStyles.replace(/<!--([^>]*)-->/gm, '/* $1 */');
}

function escapeAllJSXQuotes(text) {
    let   escapedText = '';
    let   idx         = 0;
    const comments    = [
        extractComments(text, '/*', '*/'), extractComments(text, '<!--', '-->')
    ].flat();

    while (idx !== -1) {
        const [start, end] = matchClosely(idx, text, '>', '<');
        if (start === -1 || end === -1)
            break;

        const stripped =
            escapeJSXQuotesIn(text.slice(start, end + 1), start, comments);
        escapedText += text.slice(idx, start) + stripped;

        idx = end + 1;
    }

    if (idx !== -1)
        escapedText += text.slice(idx);

    return escapedText;
}

function escapeJSXQuotesIn(text, off, comments) {
    const matches = Array.from(text.matchAll(/(\{|\})/g)).sort(sortIndexDesc);
    for (const match of matches) {
        const index = off + match.index;
        if (isInComment(text, index, comments))
            continue;

        text = text.substring(0, match.index) + '{\'' + match[1] + '\'}' +
            text.substring(match.index + match[0].length);
    }

    return text;
}

function nextOf(from, haystack, needle) {
    const idx = haystack.slice(from).indexOf(needle);
    return idx === -1 ? idx : from + idx;
}

function isInComment(text, pos, comments) {
    return comments.find(comment => pos >= comment.start && pos <= comment.end);
}

function matchClosely(pos, context, sDelim, eDelim) {
    let spos = -1, epos = -1;
    do {
        const start = nextOf(pos, context, sDelim);
        if (start === -1)
            break;
        const end = nextOf(start, context, eDelim);
        if (end === -1)
            break;
        const nextsDelim = nextOf(start + 1, context, sDelim);
        spos             = start;
        epos             = end;
        if (nextsDelim < end) {
            pos = start + 1;
        } else {
            break;
        }
    } while (true);

    return [spos, epos];
}

function extractComments(context, sDelim, eDelim) {
    const comments = [];
    let   idx      = 0;
    while (idx !== -1) {
        const start = nextOf(idx, context, sDelim);
        if (start === -1)
            break;
        const end = nextOf(start, context, eDelim);
        if (end === -1)
            break;
        comments.push({
            start: start,
            end: end,
            shift: Math.min(sDelim.length, eDelim.length)
        });

        idx = end + eDelim.length;
    }

    return comments;
}

async function extractAllScripts(doc) {
    const allScripts = Array.from(doc.querySelectorAll('script'));
    // Detach all extracted scripts.
    allScripts.forEach(script => script.remove());

    const usedIDs       = new Map();
    let   uniqueCounter = randomCounter(4);

    if (isEmpty(allScripts))
        return allScripts;

    const ID    = augment('id');
    const SRC   = augment('src');
    const TYPE  = augment('type');
    const DEFER = augment('defer');

    const scripts = [];
    for (const script of allScripts) {
        const attrs = await getAttributes(script);
        if (!attrs[DEFER]) {
            const selection = reactAttributesLookup['defer'];
            script.setAttributeNS(null, augment(selection.react), '');
        }
        const mime = attrs[TYPE] ?? 'text/javascript';
        let   src  = attrs[SRC];
        logger.info(attrs, mime, src);

        const mimeDBEntry = mimeDB[mime];
        const extension   = mimeDBEntry?.extensions?.[0] ?? 'js';

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

        scripts.push({
            script: isExternalHTML ? await adaptToHTML(doc, script) : script,
            isInline: !src,
            mime: mime,
            scriptName: src ?? `sc-${id}.${extension}`,
            content: script.innerHTML.trim()
        });
    }

    return scripts;
}

/*
 * For template html in scripts, convert them to `object` element.
 * And embed them into the page.
 */
async function adaptToHTML(doc, element) {
    const externalResolver = doc.createElement('object');
    modifyAttributes(externalResolver, await getAttributes(element));

    return externalResolver;
}

/*\
 * NB! Generator gives a maximum of 10 digits.
\*/
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

async function reconstructTree(node, pageSourceFile) {
    const siblings = [];
    for (const child of Array.from(node.children)) {
        siblings.push(await reconstructTree(child, pageSourceFile));
    }
    modifyAttributes(node, await getAttributes(node, pageSourceFile));
}

function modifyAttributes(node, attributes) {
    Object.keys(attributes).forEach(attr => {
        const provided = attr;
        attr           = attr.toLowerCase();
        let ns;
        /*\
         * Values of some attributes start with quotes
         * hence, they have to be escaped with '{' '}'
         * remove, this types of quote and replace
         * with alternating quotations.
         * e.g data-json={"key": "value"} is replaced this:
         *  data-json='"key": "value"'.
        \*/
        modifyEscapeIntent(node, provided, attributes);
        if ((ns = isNamespaced(attr))) {
            const modTag    = ns[1] + ns[2][0].toUpperCase() + ns[2].slice(1);
            const attrValue = attributes[attr];
            node.setAttributeNS(null, modTag, attrValue);
            node.removeAttribute(attr);
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
        }
    });
}

/*\
 * For namespaced attributes such
 * as SVG's xmlns:prefix, return
 * true.
\*/
function isNamespaced(attribute) {
    return attribute.match(/^([a-z-]+):([a-z-]+)$/);
}

function augment(attr) {
    return REPL_ID + attr;
}

function modifyEscapeIntent(node, attribute, attributes) {
    const value = attributes[attribute];
    if (value.startsWith('{') && value[1] !== '{' && lastEntry(value) === '}') {
        const mod = '`' + value + '`';
        node.removeAttribute(attribute);
        node.setAttribute(attribute, mod);
        Object.assign(attributes, {...attributes, [attribute]: mod});
    }
}

/*\
 * Return a non-augmented list of
 * attributes of an HTMLNode.
 * A non-augmented attribute
 * does not have it attribue
 * name prefixed by REPL_ID.
 * It is similar in structure to
 * what is returned by
 * el.getAttribute.
\*/
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

/*\
 * Return a list of augmented HTMLNode
 * attributes. The augmentation process
 * modifies each attribute to be suitable
 * for processing in the JSX context.
\*/
async function getAttributes(node, pageSourceFile) {
    const attributeNodeArray = Array.prototype.slice.call(node.attributes);

    const attrs = {};
    for (const attribute of attributeNodeArray) {
        if (attribute.name !== 'style')
            attrs[attribute.name] = attribute.value;
        else {
            attrs[attribute.name] =
                await formatStyle(attribute.value, pageSourceFile);
        }
    }

    return attrs;
}

// Format inline-styles as JSX style {{}}
async function formatStyle(value, pageSourceFile) {
    const formattedStyle = {};
    const stylist        = value.split(';').map(p => p.trim());
    const allStyles      = [];
    for (const style of stylist) {
        const div           = style.indexOf(':');
        const one           = style.slice(0, div).trim().toLowerCase();
        const other         = style.slice(div + 1).trim();
        const isUserDefined = one.startsWith('--');
        if (isEmpty(one) || isEmpty(other)) {
            continue;
        }

        const value = await updateInlineStyleAssets(other, pageSourceFile);

        const oneMatches = Array.from(one.matchAll(/-([a-z])/gm));
        if (isEmpty(oneMatches) || isUserDefined) {
            /*\
             * Escape user defined css property in inline styles
            \*/
            if (isUserDefined) {
                allStyles.push(`'${one}': \`${value}\``);
            } else {
                allStyles.push(`${one}: \`${value}\``);
            }
            continue;
        }

        const jointOne = oneMatches.reduce((acc, m, i) => {
            const section =
                m.input.substring(acc.start, m.index).toLowerCase() +
                m[1].toUpperCase();
            acc.start = m.index + m[0].length;
            return {...acc, str: acc.str + section};
        }, {start: 0, str: ''});

        allStyles.push(`${
            jointOne.str +
            oneMatches[oneMatches.length - 1].input.substring(
                jointOne.start)}: \`${value}\``);
    }
    return `{{${allStyles.join(', ')}}}`;
}

function sortIndexDesc(one, other) {
    return other.index - one.index;
}

function isFunction(any) {
    return typeof any == 'function';
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
            // Make a windows compatibility check
            if (isWindowsPath(link))
                return false;

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

function isWindowsPath(link) {
    return os.platform() === 'win32' && link.match(/^[a-zA-Z]:\\/);
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
        const matches = Array.from(html.matchAll(regex)).sort(sortIndexDesc);
        html          = expandMatches(tag, html, matches);
    }

    return html;
}

function expandMatches(tag, page, matches) {
    for (const match of matches) {
        const start = tag.length + match.index + 1;
        const end   = shiftByAttrs(page, start);

        if (page[end] === '>' && page[end - 1] === '/')
            continue;

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

function exports() {
    if (process.env.NODE_ENV === 'test') {
        return {
            resolveLandingPage,
            tryDecodeFromMagic,
            readFile,
            getRootDirectory,
            unzipProject,
            unGzipProject,
            checkIfActuallyRoot,
            findIndexFile,
            downloadProject,
            removeTemplates,
            finalizeWriter,
            buildPathTemplateFrom,
            addScripts,
            emplaceInRoot,
            deriveNameFrom,
            capitalize,
            strJoin,
            uniquefyMetas,
            isSuperSetOf,
            uniquefyPages,
            uniquefy,
            removeAbsoluteRef,
            pageIsInStream,
            joinAttrs,
            duplicatePageTemplate,
            emplaceHooks,
            removeHooks,
            deleteFilesMatch,
            emplaceRootAttrs,
            emplaceLinks,
            emplaceMetas,
            overrideSet,
            updateFaviconAddress,
            emplaceTitle,
            emplaceStyle,
            fixupWebpack,
            bt,
            relinkPages,
            fixAnchorRoutes,
            fixEmptyLinks,
            emplaceApp,
            getPageRoute,
            emplaceHTML,
            useJSXStyleComments,
            emplaceImpl,
            clip,
            updateLinksFromLinksContent,
            updateStyleLinks,
            unQuote,
            updateMissingLinks,
            copyResolvedAssetsToOutputDirectory,
            generateAssetsFinalDirectory,
            useOSIndependentPath,
            removeBackLinks,
            retrieveAssetsFromGlobalDirectory,
            filterAssetsByRelativity,
            removeRelativeHyperlinks,
            resolveGlobalAssetsPath,
            indexDirectory,
            isSelfReference,
            buildExternalSource,
            isGeneratedScriptName,
            sanitizedPrompt,
            parseFile,
            buildAssetLookup,
            isVersioned,
            initializeProjectStructure,
            buildPathIgnore,
            buildRegularExpression,
            treat,
            cleanOldFiles,
            cleanTemporaryFiles,
            removePath,
            deleteDirectory,
            extractDescription,
            extractTitle,
            extractLinks,
            extractMetas,
            extractAllPageLinks,
            getIndexer,
            extractStyles,
            escapeAllJSXQuotes,
            escapeJSXQuotesIn,
            nextOf,
            isInComment,
            matchClosely,
            extractComments,
            extractAllScripts,
            adaptToHTML,
            randomCounter,
            refitTags,
            reconstructTree,
            modifyAttributes,
            isNamespaced,
            augment,
            modifyEscapeIntent,
            getAttributesRaw,
            getAttributes,
            formatStyle,
            sortIndexDesc,
            isArray,
            isString,
            isBoolean,
            isNumber,
            isObject,
            isRegExp,
            isNotEmpty,
            isEmpty,
            isBehaved,
            isNotBehaved,
            isDefined,
            isNotDefined,
            isNull,
            isNotNull,
            isAbsoluteURI,
            isWindowsPath,
            lastEntry,
            fullPathOf,
            closeSelfClosingTags,
            expandMatches,
            shiftByAttrs,
        };
    }

    return {};
};

export default exports();
