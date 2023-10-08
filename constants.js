export function modifyLock() {
    for (const arg of arguments) {
        Object.freeze(arg);
    }
}

export const supportedSchemes =
    ['http', 'https', 'ftp', 'mailto', 'tel', 'data', 'file'];

export const supportedFonts = ['ttf', 'otf', 'woff', 'woff2', 'eot'];

export const metaTags = [
    {name: 'viewport', content: 'width=device-width, initial-scale='}, {
        name: 'theme-color',
        content: '#000000',
    },
    {name: 'description', content: 'Web site created using ReactifyHTML'}
];

export const linkTags = [
    {rel: 'icon', href: '/favicon.ico'},
    {rel: 'apple-touch-icon', href: '/logo192.png'},
    {rel: 'manifest', href: '/manifest.json'}
];

export const projectDependencyInjectionTags =
    ['audio', 'embed', 'iframe', 'img', 'input', 'source', 'track', 'video'];

export const selfClosingTags = [
    'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input',
    'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'
];

export const reactAttributesLookup = {
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
