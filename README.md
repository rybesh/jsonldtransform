## jsonldtransform

A streaming [JSON-JD](http://json-ld.org/) parser for Node.js, implemented as a [Transform](http://nodejs.org/api/stream.html#stream_class_stream_transform) stream.

## example

```JavaScript
var JSONLDTransform = require('jsonldtransform').JSONLDTransform
  , fs = require('fs')
  , transform = new JSONLDTransform()

 transform.on('context', function(o, scope){
   console.log('context', o, scope)
 })
 transform.on('graph', function(o){
   console.log('graph', o)
 })

fs.createReadStream('test/data/dpla_items.json')
  .pipe(this.transform)
  .pipe(process.stdout)
```

## why?

To make it easier to work with large and complex JSON-LD documents.

## install

```Shell
npm install jsonldtransform
```

## test

```Shell
npm test
```

## license

[MIT](http://opensource.org/licenses/MIT)