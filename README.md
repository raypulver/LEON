# LEON
## Little Endian Object Notation

This is an optimized binary format for the serialization of JavaScript data structures that works in the browser and Node. There is a C implementation of LEON and it will soon be available as an optimized native extension for PHP5 and PHP7.

LEON is a far more compact alternative to JSON that operates like a flatbuffer and is compatible with the browser. It is more compact than msgpack and also many times faster to encode/decode, even without the use of a native addon. Instead of formatting the data as a human-readable string LEON stores its byte representation as a `Buffer` in Node.js or as an `ArrayBuffer` in the browser. There is no use of compression. If the target environment does not support typed arrays LEON will fall back to using a string.

LEON provides all the capability of JSON but exchanges its readability for compactness. In addition to this, LEON runs very fast, not quite faster than JSON but very close.

LEON can be used to serialize dynamic data using `LEON.encode` and `LEON.decode`, but there is a major benefit to using LEON when you know ahead of time the types of the data you are serializing. If you know what you are sending and receiving, you can pass a template of the data to `LEON.Channel` which returns an object with its own `encode` and `decode` methods that can be used to serialize data according to the schema. Another benefit to using a `LEON.Channel` is that it will only serialize the properties of an object that you specify in the template, so there is no need to construct a whole new object with only the data you intend to send, and there is no need to send more data than is necessary. With JSON this is only partly possible, as you can only specify the keys you want to encode at the first level of depth in the object. With LEON you can specify the keys of the object you with to encode, as well as the keys for any objects it contains.

Depending on what kind of data you have, serializing through a `LEON.Channel` can be about 2-3 times more compact than serializing with JSON, after the effects of gzip. Experiment for yourself and see.

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
- `LEON.STRING` a string with char codes between 0 and 0xFF
- `LEON.UTF16STRING` a string with char codes between 0 and 0xFFFF
- `LEON.BOOLEAN` a true/false value
- `LEON.NULL` a null value
- `LEON.UNDEFINED` an undefined value
- `LEON.NAN` a NaN value
- `LEON.DATE` a Date object
- `LEON.BUFFER` a Buffer or an ArrayBuffer or a binary string consisting of single byte characters
- `LEON.REGEXP` a RegExp object
- `LEON.MINUS_INFINITY` minus infinity
- `LEON.INFINITY` positive infinity
and of course there is
- `LEON.DYNAMIC` any type

If you want to indicate that you are sending an array, you pass `LEON.Channel` an array with one element: the template of the type of data that will be in each element of the array. If you are sending an object, you pass an object with the desired keys, whose values will be a template of the type of data that will be associated with that key. For this reason, arrays must contain objects and values of the same type, and the keys and types of values of objects must be known ahead of time, unless your template includes a `LEON.DYNAMIC` component. The idea is that you will construct a `LEON.Channel` on the receiving end of the transfer using the same template, and both ends can send/receive data over this "channel."

If all of your data is dynamic, you can simply use `LEON.encode` and `LEON.decode` to serialize it.

## Examples

```
var channel = LEON.Channel({
  a: LEON.STRING,
  b: LEON.INT,
  c: [{ d: LEON.BOOLEAN, e: LEON.DATE }]
});
var obj = { a: 'word', b: -500, c: [ { d: true, e: new Date(1435767518000) }, { d: false, e: new Date(
1435767518000) } ] };
var buf = channel.encode(obj);
// 21 bytes long
obj = channel.decode(buf);
// Same object.
```
In this case, the buffer is only 21 bytes in length, compared to the purely dynamic LEON which is 60 characters, and compared to the equivalent JSON string which is 112 characters.

Another example:

```
var channel = LEON.Channel({
  strings: [ LEON.STRING ],
  numbers: [ LEON.INT ]
});
var buf = channel.encode({
  strings: ['the', 'dog', 'ate', 'the', 'cat'],
  numbers: [100, 1000, 10000, 100000]
});
channel.decode(buf);
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
var serialized = channel.encode(obj);
// 70 bytes long compared to 295 characters in JSON
channel.decode(serialized);
// Same object.
```

If you want to create a template to pass to `LEON.Channel` dynamically you can pass an example of the data to be sent to `LEON.toTemplate` and the resulting value can be used to construct a `Channel`. This can also be used to avoid having to create a template manually.  A `Channel` object also has a "inspect" method that will return a readable string representation of the Channel you can use in your code (after adding the name of the LEON object before the type constants). Be warned that `LEON.toTemplate` can be very slow if you have a large set of data, so it is best used as a tool to write templates ahead of time to be added to your project.

NOTE: LEON.Channel(LEON.DYNAMIC).encode is equivalent to LEON.encode, as well as with decode.
