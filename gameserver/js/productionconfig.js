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
        try {
            this.production = require('../production_hosts/' + config.production + '.js');
        }
        catch(err) {
            this.production = null;
        }

    }

    inProduction() {
        if(this.production !== null) {
            return this.production.isActive();
        }
        return false;
    }

    getProductionSettings() {
        if(this.inProduction()) {
            return this.production;
        }
    }
}

export default ProductionConfig;
