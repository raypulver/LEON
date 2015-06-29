# LEON
## Little Endian Object Notation

This is an optimized binary format for JavaScript data structures. Instead of storing data as a string it stores it in a Buffer object. It provides all the features of JSON but with less TCP overhead. The module exposes two functions, parse and bufferify. They can be used like so:

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
