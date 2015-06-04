# Mod Creation Guide

Mods are meant to be as easy as possible to use, but we understand that the API can be confusing.  Thus, we provide this short guide to making mods.  It is by no means exhaustive, and clearly does not replace the entire API.

## Importing

Several common mod tools have been already written.  They can be found by importing `/mods/utils/creamery/<name>`.  The most useful of these is `mod-base.js`, which it is strongly recommended that you always import.  The remainder of this document will assume that you have imported that already.

## Encoding

An encoding mod will usually take in strings and split them when a certain pattern satisfying the mod is found.  A shorthand form of this, found in the `pattern-matcher.js` utility, is useful for producing encoding mods for this reason.

```
// TODO: Sample code here
```

## Decoding

An decoding mod will usually take in the message, search for pieces with a compatible codec, and decode them to strings.  A shorthand form of this, found in the `codec-matcher.js` utility, is useful for producing encoding mods for this reason.

```
// TODO: Sample code here
```