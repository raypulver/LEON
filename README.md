# LEON
## Little Endian Object Notation

This is an optimized binary format for JavaScript data structures. Instead of storing data as a string it stores it in a Buffer object. It provides all the features of JSON but exchanges its readability for more efficiency. This module exposes three functions: `bufferify`, `parse`, and `Channel`. The first two can be used like so:

```
var LEON = require('leon');
var o = { a: 1, b: 2, c: 'd' };
var buf = LEON.bufferify(o);
// <Buffer 00 04 61 00 62 00 63 00 64 00 00 01 00 03 00 01 02 09 00 00 01 00 02 10 03>
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

The third function, `Channel`, is slightly more complex, but offers the greatest amount of optimization. You pass `Channel` a template for the data that is going to be parsed or written, and it returns an object that has it's own "parse" and "bufferify" functions for that schema of data. The goal of a Channel object is to eliminate the bytes needed to encode type information or object layout data. The limitation is that arrays must contain the same type, and you must know the keys of the object ahead of time.

Consider this example:

```
var channel = LEON.Channel({
  a: LEON.types.String,
  b: LEON.types.SignedInt,
  c: [{ d: LEON.types.Boolean, e: LEON.types.Date }]
});
var obj = { a: 'word', b: -500, c: [ { d: true, e: new Date(1435767518000) }, { d: false, e: new Date(
1435767518000) } ] };
var buf = channel.bufferify(obj);
// <Buffer 77 6f 72 64 00 0c fe ff ff 00 02 20 de 12 94 55 21 de 12 94 55>
obj = channel.parse(buf);
// Same object.
```
Notice that the buffer is only 21 bytes, compared to raw LEON which is 60 bytes, and compared to the equivalent JSON string which is 112 characters.

A full list of types is in `LEON.types`

To denote that you are transferring an object you pass `Channel` an object with the desired fields and associated types, and to denote you are transferring an array you pass an array with a single element, the type of the elements of the array. If you want to encode an array of objects in a channel, they must have the same keys and associated types. Another example:

```
var channel = LEON.Channel({ strings: [ LEON.types.String ], numbers: [ LEON.types.Int ] });
var buf = channel.bufferify({ strings: ['the', 'dog', 'ate', 'the', 'cat'], numbers: [100, 1000, 10000, 100000]});
// <Buffer 00 05 74 68 65 00 64 6f 67 00 61 74 65 00 74 68 65 00 63 61 74 00 00 04 64 e8 03 10 27 a0 86 01 00>
channel.parse(buf);
// Same object.
```
