import { createRequire } from 'module';

// NOTE: `init()`/the constructor below needs a *synchronous*, dynamically
// computed require (the path depends on `config.production`, which isn't
// known until runtime). Static ES `import` statements only accept string
// literals, and dynamic `import()` is always asynchronous, which would
// change this constructor's (and its callers') behavior. `createRequire`
// is the standard, documented way to keep a synchronous, computed
// `require()` available inside an ES module, so it is used here to
// preserve the exact original behavior.
const require = createRequire(import.meta.url);

class ProductionConfig {
    constructor(config) {
        this.config = config;

        // FIX: config.production was concatenated straight into a require()
        // path with no validation. It's operator-controlled config today
        // (not remote/client input), so this wasn't reachable as a live
        // path-traversal bug, but there was nothing here stopping a value
        // like '../../../../etc/passwd%00' or '../secrets/whatever' from
        // being require()'d if this field's provenance ever changed (e.g.
        // became settable from a merged/less-trusted config source). Added a
        // whitelist check as cheap defense-in-depth: only plain filename
        // characters are allowed, matching what a real production_hosts/*.js
        // module name should look like.
        const isSafeProductionName =
            typeof config.production === 'string' &&
            /^[A-Za-z0-9_-]+$/.test(config.production);

        try {
            if (!isSafeProductionName)
                throw new Error(
                    'Invalid config.production value: ' + config.production
                );

            this.production = require(
                '../production_hosts/' + config.production + '.js'
            );
        } catch (err) {
            this.production = null;
        }
    }

    inProduction() {
        if (this.production !== null) {
            return this.production.isActive();
        }
        return false;
    }

    getProductionSettings() {
        if (this.inProduction()) {
            return this.production;
        }
    }
}

export default ProductionConfig;
