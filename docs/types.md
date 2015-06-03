# Types

The following are the types used by À la Mod.

## Message Parts

*Message parts* are pieces of a message.  They are represented as either strings or objects, and provide information about both their content and how they have been encoded.

If the message part is a string, that indicates that no encoder has processed it.  The content of the message is simply the string representing it, and the type is implicitly defined as `com.alamod.plaintext`.

If the message part is an object, that indicates that one or more encoders have processed it.  The message part will take the following format:

```js
{
	codec: <codec object>,
	content: <object>,
	fallback: <string>
}
```

The `codec` specifies how the data is encoded.  (See the format of codec objects below.)  The `content` object contains the actual content of the message under the given codec.  The `fallback` is what À la Mod prints if a received message part is not decoded by any decoder.

## Codec Objects

A *codec object* is a simple JSON object that serves as an identifier for a codec.  It doesn't contain any information about *how* data can be encoded into or out of the codec; it only names the codec type and its namespace.

Codec objects follow the following format:

```js
{
	namespace: <string>,
	type: <string>
}
```

The codec's `namespace` is usually an identification of who wrote the mod, and is provided to avoid naming collisions.  (However, it may purposely match codecs of other mods to seek compatibility.)  The codec's `type` describes the actual content it contains.

*A quick note on convention: when discussing codecs, use the syntax `<namespace>.<type>`; for example, a mod with the namespace `alamod.creamery` and the type `link` should be written as `alamod.creamery.link`.*

### Official Codecs

The Creamery provides several "official codecs" in order to help standardize mods that use common types of data.

- `alamod.creamery.link` - contains a link, consisting of a URL and the text content associated with it