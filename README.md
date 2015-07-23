# LEON
## Little Endian Object Notation

This is an optimized binary format for JavaScript data structures that works in the browser or Node. Instead of formatting the data as a human-readable string LEON stores it as a binary string that is optimized for compactness. It provides all the features of JSON but exchanges its readability for more efficiency. This module exposes three functions: `stringify`, `parse`, and `Channel`. The first two can be used like so:

```
var LEON = require('leon');
var o = { a: 1, b: 2, c: 'd' };
var buf = LEON.stringify(o);
// '\u0000\u0004a\u0000b\u0000c\u0000d\u0000\u0000\u0001\u0000\u0003\u0000\u0001\u0002\t\u0000\u0000\u0001\u0000\u0002\u0010\u0003'
LEON.parse(buf);
// { a: 1, b: 2, c: 'd' }; 
```

Besides storing numerical values in the smallest amount of bytes possible, LEON has a particular advantage over JSON in that it indexes strings, storing unique strings only only once. Consider the following JSON:

```
[{
  "recurring": true,
  "key": false,
  "words": "create unneeded overhead"
 }, {
  "recurring": false,
  "key": true,
  "words": "do not exist in LEON"
 },
 {
  "recurring": true,
  "key": false,
  "words": "are the enemy"
 }]
```

This JSON is 184 characters. The equivalent structure stored in LEON is 120 bytes.

The third function, `Channel`, is slightly more complex, but offers the greatest amount of optimization. You pass `Channel` a template for the data that is going to be parsed or written, and it returns an object that has it's own "parse" and "stringify" functions for that schema of data. The goal of a Channel object is to eliminate the bytes needed to encode type information or object layout data. The limitation is that arrays must contain the same type, and you must know the keys of the object ahead of time. An array of objects must contain objects with the same keys and associated values.

Consider this example:

```
var channel = LEON.Channel({
  a: LEON.types.STRING,
  b: LEON.types.INT,
  c: [{ d: LEON.types.BOOLEAN, e: LEON.types.DATE }]
});
var obj = { a: 'word', b: -500, c: [ { d: true, e: new Date(1435767518000) }, { d: false, e: new Date(
1435767518000) } ] };
var buf = channel.stringify(obj);
// 'word\u0000\u000bþÿÿ\u0000\u0002 Þ\u0012U!Þ\u0012U'
obj = channel.parse(buf);
// Same object.
```
Notice that the buffer is only 21 bytes, compared to raw LEON which is 60 bytes, and compared to the equivalent JSON string which is 112 characters.

A full list of types is in `LEON.types`

To denote that you are transferring an object you pass `Channel` an object with the desired fields and associated types, and to denote you are transferring an array you pass an array with a single element, the type of the elements of the array. Again, if you want to encode an array of objects in a channel, they must have the same keys and associated types. Another example:

```
var channel = LEON.Channel({ strings: [ LEON.types.STRING ], numbers: [ LEON.types.INT ] });
var buf = channel.stringify({ strings: ['the', 'dog', 'ate', 'the', 'cat'], numbers: [100, 1000, 10000, 100000]});
channel.parse(buf);
// Same object.
```

Now if you want to create a template to pass to `LEON.Channel` dynamically you can pass an example of the data to be sent to `LEON.toTemplate` and the resulting value can be used to construct a `Channel`.

NOTE: If you are using LEON in Node.js then a Buffer will deserialize as a native Buffer object, but if you are using LEON in the browser then it will attempt to deserialize to a StringBuffer object. If StringBuffer has not been loaded and LEON attempts to deserialize a Buffer in the browser it will throw. You can find StringBuffer here:

http://github.com/raypulver/string-buffer
