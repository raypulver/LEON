# LEON
## Little Endian Object Notation

This is an optimized binary format for the serialization of JavaScript data structures that works in the browser and Node. There is a C implementation of LEON and it is currently available as an optimized native extension for PHP5 and PHP7.

LEON is a far more compact alternative to JSON that operates like a flatbuffer and is compatible with the browser. Instead of formatting the data as a human-readable string LEON stores it as a string containing the value's byte representation. There is no use of compression. Thus LEON provides all the features of JSON but exchanges its readability for efficiency. LEON can be used to serialize dynamic data using `LEON.stringify` and `LEON.parse`, but there is a major benefit to using LEON when you know ahead of time the types of the data you are serializing. If you know what you are sending and receiving, you can pass a template of the data to `LEON.Channel` which returns an object with its own `stringify` and `parse` methods that can be used to serialize data according to the schema. Another benefit to using a `LEON.Channel` is that it will only serialize the properties of an object that you specify in the template, so there is no need to construct a whole new object with only the data you intend to send, and there is no need to send more data than is necessary.

Depending on what kind of data you have, serializing through a `LEON.Channel` can be about 3-10 times more compact than serializing with JSON. Experiment for yourself and see.

## Usage

The LEON object exposes a number of constants that can be used to construct a template that can be passed to `LEON.Channel`. Some types might be considered extraneous but they are included for completeness to ensure that any value that JavaScript understands can be serialized. They include:

- `LEON.UNSIGNED_CHAR` an 8-bit unsigned value
- `LEON.CHAR` an 8-bit value with a sign bit
- `LEON.UNSIGNED_SHORT` a 16-bit unsigned value
- `LEON.SHORT` a 16-bit value with a sign bit
- `LEON.UNSIGNED_INT` a 32-bit unsigned value
- `LEON.INT` a 32-bit value with a sign bit
- `LEON.FLOAT` a 32-bit floating point value
- `LEON.DOUBLE` a 64-bit floating point value
- `LEON.STRING` a string
- `LEON.BOOLEAN` a true/false value
- `LEON.NULL` a null value
- `LEON.UNDEFINED` an undefined value
- `LEON.NAN` a NaN value
- `LEON.DATE` a Date object
- `LEON.BUFFER` a Buffer object or a StringBuffer object if you are in an environment other than Node.js (see below)
- `LEON.REGEXP` a RegExp object
- `LEON.MINUS_INFINITY` minus infinity
- `LEON.INFINITY` positive infinity
and of course there is
- `LEON.DYNAMIC` any type

If you want to indicate that you are sending an array, you pass `LEON.Channel` an array with one element, a template of the type of data that will be in each element of the array. If you are sending an object, you pass an object with the desired keys, whose values will be a template of the type of data that will be associated with that key. For this reason, arrays must contain objects and values of the same type, and the keys and types of values of objects must be known ahead of time. The idea is that you will construct a `LEON.Channel` on the receiving end of the transfer using the same template, and both ends can send/receive data over this "channel."

If all of your data is dynamic, you can simply use `LEON.stringify` and `LEON.parse` to serialize it. If you want to minimize the byte-length of the serialized dynamic data (at a slight cost to performance) you can optionally pass `LEON.USE_INDEXING` as the second argument to these two functions and LEON will index any recurring strings and also the appearance of keys in any serialized objects. This is only recommended if your dynamic data has many objects with the same keys. The less dynamic the data is, the more useful this can be. This sort of indexing does not apply to the `stringify` and `parse` methods of a `LEON.Channel` object.

Note: If all of your data is purely dynamic and indexing is not applicable, you should not use LEON to serialize. Although the resulting string will be of smaller bytesize, it does not outweigh the performance benfit of using JSON, since JSON is implemented via native bindings.

## Examples

```
var channel = LEON.Channel({
  a: LEON.STRING,
  b: LEON.INT,
  c: [{ d: LEON.BOOLEAN, e: LEON.DATE }]
});
var obj = { a: 'word', b: -500, c: [ { d: true, e: new Date(1435767518000) }, { d: false, e: new Date(
1435767518000) } ] };
var buf = channel.stringify(obj);
// 'word\u0000\u000bþÿÿ\u0000\u0002 Þ\u0012U!Þ\u0012U'
obj = channel.parse(buf);
// Same object.
```
Notice that the buffer is only 21 characters, compared to raw LEON which is 60 characters, and compared to the equivalent JSON string which is 112 characters.

Another example:

```
var channel = LEON.Channel({
  strings: [ LEON.STRING ],
  numbers: [ LEON.INT ]
});
var buf = channel.stringify({
  strings: ['the', 'dog', 'ate', 'the', 'cat'],
  numbers: [100, 1000, 10000, 100000]
});
channel.parse(buf);
// Same object.
```
Now consider an example which includes dynamic data:
```
var obj = {
  staticallyTypedData: [
    {
      first: 55,
      second: 70,
      third: -100,
      fourth: false
    }, {
      first: 72,
      second: -50,
      third: -20,
      fourth: true
    }, {
      first: 33,
      second: 22,
      third: -22,
      fourth: false
    }
  ],
  dynamicallyTypedData: [
    { a: Infinity, b: NaN, c: /54/i },
    false,
    new Date(),
    { d: 5, e: true, f: 'woop' }
  ]
};
var channel = LEON.Channel({
  staticallyTypedData: [{ first: LEON.CHAR, second: LEON.CHAR, third: LEON.CHAR, fourth: LEON.BOOLEAN }],
  dynamicallyTypedData: [LEON.DYNAMIC]
});
var serialized = channel.stringify(obj);
//'\u0000\u0004\t\u0000\u0003\u0000\u0001a\u0019\u0000\u0001b\u0018\u0000\u0001c\u0017\u0000\u000254\u0000\u0001i!\u0015\u0000ðÜ_òtB\t\u0000\u0003\u0000\u0001d\u0000\u0005\u0000\u0001e \u0000\u0001f\u0010\u0000\u0004woop\u0000\u00037!FH Îì!!\u0016ê'
// 70 characters long compared to 295 characters in JSON
channel.parse(serialized);
// Same object.
```

If you want to create a template to pass to `LEON.Channel` dynamically you can pass an example of the data to be sent to `LEON.toTemplate` and the resulting value can be used to construct a `Channel`. This can also be used to avoid having to create a template manually.

NOTE: LEON.Channel(LEON.DYNAMIC).stringify is equivalent to LEON.stringify, as well as with parse.

NOTE: If you are using LEON in Node.js then a Buffer will deserialize as a native Buffer object, but if you are using LEON in the browser then it will attempt to deserialize to a StringBuffer object. If StringBuffer has not been loaded and LEON attempts to deserialize a Buffer in the browser it will throw. You can find StringBuffer here:

http://github.com/raypulver/string-buffer

Alternatively you can install StringBuffer with

```
npm install string-buffer
bower install string-buffer
```
