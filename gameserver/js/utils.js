import sanitizer from 'sanitizer';
import Utils from '../shared/js/utils.js';

Utils.sanitize = function(string) {
    // Strip unsafe tags, then escape as html entities.
    return sanitizer.escape(sanitizer.sanitize(string));
};

export default Utils;
