# À la Mod

Welcome to À la Mod!  Etc.

This documentation is designed for developers of omds and other resources.  **This is not a user guide.**  Don't expect to find usage instructions here.

## Commands in Web Workers

All mods in À la Mod are created as Web Workers.  As the main thread can't call methods in these directly, a special communication protocol is used to obtain data.

Commands are issued to Web Workers in the form of calls to the `postMessage()` function.  The passed argument is an object, containing two fields - `method` and `args`.  This is requesting that the given worker call the method specified in `method` with the arguments provided in `args` and return the result.  When returning, `method` should be specified as `return`.