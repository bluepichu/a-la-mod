# À la Mod

Welcome to À la Mod!  Etc.

This documentation is designed for developers of omds and other resources.  **This is not a user guide.**  Don't expect to find usage instructions here.

## General Structure

The primary structure of À la Mod is formatted to enable developers as much freedom as possible while still taking into account security concerns for the end user.  *For this reason, no third-party code is assumed to be safe; all mods are sandboxed and only have methods they may need exposed to them.*  This is accomplished through the use of Web Workers and iframes.

The main (UI) thread is reserved for core À la Mod code only, with the exception of sandboxed UI code.

The page may also contain sandboxed iframes associated with mods.  These are given a virtual connection to their associated mods and can pass data using their `postMessage()` method.

When encoding is necessary, mods are called through Web Workers.  These run as parallel threads to the main thread, allowing the UI thread to continue updating properly.  However, they contain no direct UI access and can only indirectly communicate with their associated iframe via their `postMessage()` method.

## Issuing Commands in Mods

All mods in À la Mod are created as Web Workers, potentially with assocaited sandboxed UI content.  As the main thread can't call methods in these directly (and vice versa), a special communication protocol is used to obtain data.

Commands are issued to Web Workers and iframes in the form of calls to the `postMessage()` function.  The passed argument is an object, containing two fields - `method` and `options`.  This is requesting that the given mod call the method specified in `method` with the arguments provided in `args` and return the result.  The worker may issue commands to the main thread by the same method.
	
When returning content, `method` should be specified as `return`.