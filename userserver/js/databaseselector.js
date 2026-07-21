import path from 'path';

const DatabaseSelector = async (config) => {
    // Hardcoded to Redis for now
    const module = await import('./redis.js');

    // Return the default export (or the whole module)
    return module.default || module;
};

export default DatabaseSelector;
