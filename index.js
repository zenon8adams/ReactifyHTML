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

const STYLE_TAG = 'STYLE_CONTENT';
const APP_TAG   = 'APP_CONTENT';
const HOOKS_TAG = 'HOOKS_CONTENT';
const TITLE_TAG = 'TITLE_CONTENT';
const META_TAG  = 'META_CONTENT';
const LINK_TAG  = 'LINK_CONTENT';

const STYLE_INC_TAG  = 'STYLE_INCLUDE';
const HOOKS_INC_TAG  = 'HOOKS_INCLUDE';
const SCRIPT_INC_TAG = 'SCRIPT_INCLUDE';

const ROOT_ATTR_TAG = 'ROOT_ATTRIBUTES';

const BUILD_DIR = 'build';
const HOOKS_DIR = 'hooks';

const converterConfig = {
    useHooks: false,
    zip: false
};

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
logger.info =
    function() {
    info(util.format.apply(null, arguments));
}

const sourceFile = process.argv[2] ?? 'examples/index.html';

fs.readFile(sourceFile, 'utf8', async (err, content) => {
    if (err) {
        logger.error(err);
        return;
    }

    logger.info('\n\n', '='.repeat(200), '\n\n\n');

    const dom  = new jsdom.JSDOM(escapeAllJSXQuotes(content));
    const doc  = dom.window.document;
    const root = doc.querySelector('html');

    /* We don't need edited attributes
     * since we know that we are not going to
     * be loaded in a react sensitive context
     * */
    const pageMetas = extractMetas(doc);
    const pageLinks = extractLinks(doc);
    const pageTitle = extractTitle(doc, root);

    logger.info('Title of page', pageTitle);

    reconstructTree(root);
    const scripts    = extractAllScripts(doc, root);
    const pageStyles = extractStyles(doc, root);
    const rawHTML =
        closeSelfClosingTags(adjustHTML(dom.window.document.body.innerHTML));
    logger.info('All scripts: ', scripts);
    logger.info('All styles: ', pageStyles);
    try {
        await cleanOldFiles();

        const processingParams = await initializeProjectStructure();

        await updateMissingLinks(doc, processingParams, pageLinks, scripts);
        await emplaceRootAttrs(root, processingParams);
        await emplaceStyle(pageStyles, processingParams);
        await emplaceTitle(pageTitle, processingParams);
        await emplaceMetas(pageMetas, processingParams);
        await emplaceLinks(pageLinks, processingParams);
        await addScripts(scripts, processingParams);
        await emplaceHTML(rawHTML, processingParams);

        await removeUnusedTags(processingParams);
    } catch (err) {
        logger.error(err);
        await cleanOldFiles();
        process.exit(1);
    }

    logger.info('\n\n', '='.repeat(200), '\n\n\n');

    process.exit(0);
});

async function removeUnusedTags(resourcePath) {
    const {appB, scriptB, rootB} = resourcePath;

    logger.info('resourcePath', resourcePath);
    await emplaceImpl(STYLE_INC_TAG, appB, appB, '');
    await emplaceImpl(STYLE_INC_TAG, scriptB, scriptB, '');
    await emplaceImpl(HOOKS_TAG, appB, appB, '');
    await emplaceImpl(HOOKS_INC_TAG, appB, appB, '');
    await emplaceImpl(SCRIPT_INC_TAG, rootB, rootB, '');
    await emplaceImpl(ROOT_ATTR_TAG, rootB, rootB, ' lang="en"');
}

async function addScripts(scripts, resourcePath) {
    const {publicB, srcB} = resourcePath;
    const useScripts      = scripts.filter(script => script.isInline);
    const scriptsFullPath = path.join(
        !converterConfig.useHooks ? publicB : srcB, 'assets',
        'script' + ['', 's'].at(useScripts.length > 1));

    if (isEmpty(useScripts)) {
        await removeHooks('*', resourcePath);
    } else {
        await fsp.mkdir(scriptsFullPath, {recursive: true});
        await Promise.all(useScripts.map(
            async (script) => await fsp.writeFile(
                path.join(scriptsFullPath, script.name), script.content)));
    }

    await[emplaceInRoot, emplaceHooks].at(converterConfig.useHooks)(
        scripts, scriptsFullPath, resourcePath);
}

async function emplaceInRoot(scripts, scriptsFullPath, resourcePath) {
    const scriptBasename = path.basename(scriptsFullPath);
    const scriptsList =
        scripts
            .reduce(
                (acc, script) => {
                    if (!script.isInline) {
                        const attrs = joinAttrs(
                            getAttributesRaw(script.script),
                            {src: script.name});
                        return acc + `<script ${attrs}></script>` +
                            '\n\t';
                    } else {
                        return acc + '<script src=\'' +
                            path.join(scriptBasename, script.name) +
                            '\' type=\'' + script.mime + '\'></script>\n\t';
                    }
                },
                '\n\t')
            .trimEnd();

    const {rootB} = resourcePath;
    await emplaceImpl(SCRIPT_INC_TAG, rootB, rootB, scriptsList);
    await removeHooks('*', resourcePath);
}

function joinAttrs(attrs, extras) {
    return Object.entries({...attrs, ...extras})
        .reduce((acc, [k, v]) => acc + k + '=\'' + v + '\' ', '')
        .trim();
}

async function emplaceHooks(scripts, scriptsFullPath, resourcePath) {
    const scriptBasename = path.basename(scriptsFullPath);
    const scriptsList    = scripts.reduce(
           (acc, script) => acc + '\'' +
               (!script.isInline ? script.name :
                                   path.join(scriptBasename, script.name)) +
               '\'' +
               ',\n\t',
           '\n\t');
    const hook =
        `\n\tconst [loadedScripts, error] = useScript([${scriptsList}]);`;
    const include = `\nimport './hooks/useScript';`;

    const {app, appB} = resourcePath;
    await emplaceImpl(HOOKS_TAG, appB, appB, hook);
    await emplaceImpl(HOOKS_INC_TAG, appB, appB, include);
}

async function removeHooks(hooks, resourcePath) {
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

    if (isNotEmpty(attrs))
        await emplaceImpl(ROOT_ATTR_TAG, rootB, rootB, ' ' + attrs);
}

async function emplaceLinks(links, processingParams) {
    await emplaceLinksOrMetasImpl(links, true /* isLink */, processingParams);
}

async function emplaceMetas(metas, processingParams) {
    if (isEmpty(metas))
        metas.push({charset: 'utf-8'});

    await emplaceLinksOrMetasImpl(metas, false /* isLink */, processingParams);
}

async function emplaceLinksOrMetasImpl(linksOrMetas, isLink, processingParams) {
    const tag       = isLink ? '<link ' : '<meta ';
    const finalList = overrideSet(isLink ? linkTags : metaTags, linksOrMetas);
    const stringLinksOrMetas =
        finalList
            .map(current => {
                const joint = joinAttrs(current);
                return tag + joint + '/>';
            })
            .reduce((cur, linkOrMeta) => cur + linkOrMeta + '\n', '\n');

    const {rootB} = processingParams;
    await emplaceImpl(
        isLink ? LINK_TAG : META_TAG, rootB, rootB, stringLinksOrMetas);
}

function overrideSet(standard, given) {
    logger.info('overrideSet(): given --- ', given, ', standard: ', standard);
    const visibilityMap = new Map();
    const finalSet      = Object.assign([], standard);

    standard.forEach((entry, index) => visibilityMap.set(entry.name, index));
    given.forEach(entry => {
        if (entry?.name)
            finalSet[visibilityMap.get(entry.name)] = entry;
        else
            finalSet.push(entry);
    });

    logger.info('FinalSet --- ', finalSet);

    return finalSet;
}

async function emplaceTitle(title, processingParams) {
    const {rootB} = processingParams;

    await emplaceImpl(TITLE_TAG, rootB, rootB, title);
}

async function emplaceStyle(content, resourcePath) {
    const {style, styleB, appB, scriptB} = resourcePath;
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

async function emplaceHTML(rawHTML, resourcePath) {
    const {app, appB} = resourcePath;

    await emplaceImpl(APP_TAG, appB, appB, useJSXStyleComments(rawHTML));
}

function useJSXStyleComments(rawHTML) {
    return rawHTML.replace(/<!--((?:.|\n|\r)*?)-->/gm, '{/*\$1*/}');
}

async function emplaceImpl(tag, readPath, writePath, replacement) {
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
    const mL         = maxLen === undefined ? str.length : maxLen;
    const clippedStr = str.slice(0, Math.min(mL, str.length));
    return clippedStr.length === str.length ? clippedStr : clippedStr + '...';
}

async function updateMissingLinks(doc, resourcePath) {
    const modifiables =
        buildExternalSource(doc, Array.from(arguments).slice(2));
    const modifiableKeys = modifiables.map(selection => selection.value);

    logger.info(modifiables);

    if (isEmpty(modifiables))
        return;

    const pathIgnore = await buildPathIgnore(sourceFile);

    const assetDirLookup = buildAssetLookup();
    const pathIgnoreRe   = new RegExp(pathIgnore);

    console.info(
        'The following assets are loaded by this project',
        '\nand requires you to supply a path to them.',
        '\nYou can supply a directory containing all assets',
        '\nThe asset will be picked from there');
    const     resolvedAssetsPath =
        await processGlobalAssetExtraction(modifiableKeys, pathIgnoreRe);

    await copyResolvedAssetsToOutputDirectory(
        resolvedAssetsPath, modifiables, resourcePath);

    for (const asset of modifiables) {
        const repl = resolvedAssetsPath[asset.value];
        if (!isBehaved(repl))
            continue;

        const augmentedPath =
            path.join('assets', assetDirLookup[repl.extv2], repl.base);
        if (asset.isHTMLElement) {
            asset.element.setAttribute(asset.source, augmentedPath);
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
    const {publicB} = resourcePath;

    const assetDirLookup = buildAssetLookup();
    for (const asset of assetsList) {
        const repl = resolvedAssetsPath[asset.value];
        if (!isBehaved(repl))
            continue;

        logger.info('Repl: ', repl);
        const assetsRealPath = path.join('assets', assetDirLookup[repl.extv2]);
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

async function processGlobalAssetExtraction(assetsList, excludeRe) {
    try {
        const providedPath = await prompt(`Give directory to all assets: `);

        const pathInfo = fs.statSync(providedPath);
        if (pathInfo.isDirectory()) {
            const        maxDepth = 4;
            return await retrieveAssetsFromGlobalDirectory(
                providedPath, assetsList, excludeRe, maxDepth);
        } else
            throw 'Error: Invalid path provided';
    } catch (err) {
        console.error(err);
    }
}

async function retrieveAssetsFromGlobalDirectory(
    globalAssetsPath, assetsList, excludePattern, maxDepth) {
    const directoryIDX = await indexDirectory(globalAssetsPath, {}, 0);

    const requestedAssetsResolvedPath = {};

    for (const asset of assetsList) {
        const {realpath, version, ext, extv2, base} = parseFile(asset);
        const providedAsset                         = directoryIDX[base];
        if (providedAsset) {
            if (Array.isArray(providedAsset)) {
                console.info(
                    '\nThe following list of assets match',
                    '\nYour request for the file:', base,
                    '\nEnter the number in front to choose', '\nthe file: ');
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
                        'The file you requested requires version:', version);
                }
                const reply = await sanitizedPrompt('Enter your selection: ');
                assert(Number.isFinite(+reply));
                requestedAssetsResolvedPath[asset] =
                    providedAsset[(+reply + (+reply === 0)) - 1];

            } else {
                console.info(
                    '\nThe file found at', providedAsset.realpath,
                    '\nhas been selected as a match for the file:', base);
                requestedAssetsResolvedPath[asset] = providedAsset;
            }
        } else {
            console.log(
                '\nCannot find asset by the name:', base,
                'its resolution is left to you');
        }
    }

    async function indexDirectory(globalAssetsPath, aggregations, depth) {
        if (depth >= maxDepth)
            return aggregations;

        const directoryIterator = await fsp.readdir(globalAssetsPath);
        for (const file of directoryIterator) {
            const filePath    = path.join(globalAssetsPath, file);
            const stat        = fs.statSync(filePath);
            const isDirectory = stat.isDirectory(filePath);

            if (excludePattern.exec(filePath))
                continue;

            if (isDirectory) {
                await indexDirectory(filePath, aggregations, depth + 1);
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

        return aggregations;
    }

    return requestedAssetsResolvedPath;
}

function buildExternalSource(doc, tags) {
    return tags
        .flat()
        // Remove generated scripts
        .filter(link => !(link.isInline && link.name && link.mime))
        .concat(
            projectDependencyInjectionTags
                .map(tag => Array.from(doc.querySelectorAll(tag)))
                .flat()
                .map(el => ({attribute: getAttributesRaw(el), element: el})))
        .map(link => {
            const {attribute, element} = link;
            const tag                  = attribute ?? link;
            const isHTMLElement        = isBehaved(element);
            if (tag.src) {
                return {
                    source: 'src',
                    value: tag.src,
                    isHTMLElement: isHTMLElement,
                    element: isHTMLElement ? element : link
                };
            } else if (tag.href) {
                return {
                    source: 'href',
                    value: tag.href,
                    isHTMLElement: isHTMLElement,
                    element: isHTMLElement ? element : link
                };
            } else if (tag.name) {
                return {
                    source: 'name',
                    value: tag.name,
                    isHTMLElement: isHTMLElement,
                    element: isHTMLElement ? element : link
                };
            }
        })
        .filter(link => !isAbsouteURI(link.value));
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

    const mimeDB = require('mime-db');
    const assetDirLookup =
        Object.keys(mimeDB)
            .filter((mimeKey) => mimeDB[mimeKey].extensions)
            .map(
                mimeKey => mimeDB[mimeKey].extensions.map(
                    ext => ({[ext]: mimeKey.split('/')[0]})))
            .reduce((acc, cur) => ({...acc, ...cur.shift()}), {});

    return buildAssetLookup.assetDirLookup = assetDirLookup;
}

function isVersioned(file) {
    return file.search(/v\d+(\.\d+)*.+/) !== -1;
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

    const srcFullPath      = path.join(templateFullPath, 'src');
    const publicFullPath   = path.join(templateFullPath, 'public');
    const indexCssFullPath = path.join(srcFullPath, 'index.css');
    const indexJsFullPath  = path.join(srcFullPath, 'index.js');
    const rootHTMLFullPath = path.join(publicFullPath, 'index.html');
    const appFullPath      = path.join(srcFullPath, 'App.js');

    const srcBuildFullPath      = path.join(buildDirFullPath, 'src');
    const publicBuildFullPath   = path.join(buildDirFullPath, 'public');
    const indexCssBuildFullPath = path.join(srcBuildFullPath, 'index.css');
    const indexJsBuildFullPath  = path.join(srcBuildFullPath, 'index.js');
    const rootHTMLBuildFullPath = path.join(publicBuildFullPath, 'index.html');
    const appBuildFullPath      = path.join(srcBuildFullPath, 'App.js');

    return {
        src: srcFullPath,
        public: publicFullPath,
        style: indexCssFullPath,
        script: indexJsFullPath,
        root: rootHTMLFullPath,
        app: appFullPath,

        srcB: srcBuildFullPath,
        publicB: publicBuildFullPath,
        styleB: indexCssBuildFullPath,
        rootB: rootHTMLBuildFullPath,
        scriptB: indexJsBuildFullPath,
        appB: appBuildFullPath
    };
}

async function buildPathIgnore(sourceFile) {
    const basePath       = path.dirname(sourceFile);
    const pathIgnoreFile = path.join(basePath, '.pathignore');
    if (!fs.existsSync(pathIgnoreFile))
        return;

    const content = (await fsp.readFile(pathIgnoreFile)).toString();
    return buildRegularExpression(content);
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

function extractTitle(doc, node) {
    const titleElement = doc.querySelector('title');
    const title        = titleElement?.innerHTML?.trim();
    const repl         = 'React App';
    titleElement?.remove();

    return titleElement ? title : repl;
}

function extractLinks(doc) {
    return extractPropsImpl(doc, 'head link');
}

function extractMetas(doc) {
    return extractPropsImpl(doc, 'head meta');
}

function extractPropsImpl(doc, selector) {
    const allProps = Array.from(doc.querySelectorAll(selector));
    if (isEmpty(allProps))
        return [];

    return allProps.map(prop => getAttributesRaw(prop));
}

function extractStyles(doc, node) {
    const allStyles = Array.from(doc.querySelectorAll('style'));
    if (isEmpty(allStyles))
        return [];

    const jointStyles = allStyles.map(style => style.innerHTML)
                            .reduce((acc, style) => acc + '\n' + style, '')
                            .trim();

    allStyles.forEach(style => style.remove());

    return jointStyles;
}

function escapeAllJSXQuotes(text) {
    return text.replace(/\{([^\}]+?)\}/gm, `{'{$1}'}`);
}

function extractAllScripts(doc, node) {
    const allScripts    = Array.from(doc.querySelectorAll('script'));
    const usedIDs       = new Map();
    let   uniqueCounter = randomCounter(4);

    if (isEmpty(allScripts))
        return allScripts;

    const ID   = augment('id');
    const SRC  = augment('src');
    const TYPE = augment('type');

    const scripts = allScripts.map(script => {
        const attrs = getAttributes(script);
        const mime  = attrs[TYPE] ?? 'text/javascript';
        let   src   = attrs[SRC];
        logger.info(attrs, mime, src);

        assert.notEqual(mime.indexOf('javascript'), -1);

        let id = null;
        if (!src) {
            if (!attrs[ID] || !usedIDs.get(attrs[ID])) {
                usedIDs.set(id = uniqueCounter++);
            } else if (!id) {
                id = attrs[ID];
            }
        }

        assert.notEqual(src || id, null);

        return {
            script: script,
            isInline: !src,
            mime: mime,
            name: src ?? `sc-${id}.js`,
            content: script.innerHTML.trim()
        };
    });

    scripts.forEach(script => {
        script.script.remove();
    });

    return scripts;
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
function adjustHTML(semiRawHTML) {
    return semiRawHTML.replace(new RegExp(`${REPL_ID}([a-z]+)`, 'gm'), '\$1')
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
        if (reactAttributesLookup[attr]) {
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

function isNotEmpty(list) {
    return !isEmpty(list);
}

function isEmpty(list) {
    return list.length === 0;
}

function isBehaved(any) {
    return any !== undefined;
}

function isNull(any) {
    return any === null;
}

function isNotNull(any) {
    return !isNull(any);
}

function isAbsouteURI(link) {
    return isURI(link);
}

function isURI(link) {
    try {
        new URL(link);
        return true;
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

var metaTags = [
    {name: 'viewport', content: 'width=device-width, initial-scale='}, {
        name: 'theme-color',
        content: '#000000',
    },
    {name: 'description', content: 'Web site created using jsx-generator'}
];

var linkTags = [
    {rel: 'icon', href: '%PUBLIC_URL%/favicon.ico'},
    {rel: 'apple-touch-icon', href: '%PUBLIC_URL%/logo192.png'},
    {rel: 'manifest', href: '%PUBLIC_URL%/manifest.json'}
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
