import { createRequire } from 'module';

// This file is loaded as an ES module (the rest of the codebase uses
// import/export), so the CommonJS `require` global doesn't exist here.
// createRequire gives us a working `require` for this one dynamic,
// config-driven path without converting the whole module system.
const require = createRequire(import.meta.url);

class ProductionConfig {
    constructor(config) {
        this.config = config;

        try {
            this.production = require('../production_hosts/' + config.production + '.js');
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
