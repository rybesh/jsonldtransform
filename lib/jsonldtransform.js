var Transform = require('stream').Transform
  , clarinet = require('clarinet')
  , util = require('util')

function JSONLDTransform(options) {
  if (!options) options = {}
  options.objectMode = true
  if (!(this instanceof JSONLDTransform))
    return new JSONLDTransform(options)

  Transform.call(this, options)
  this._parser = clarinet.parser()
  this._state = null
  this._stack = []
  this._parsingContext = false
  var self = this

  function isURI(o) {
    var keys = Object.keys(o)
    return (keys.length === 1 && keys[0] === '@id')
  }

  function isGraph(o) {
    return ('@graph' in o)
  }

  function isContext() {
    return (self._stack.length && 
            self._stack.slice(-1)[0].key == '@context')
  }

  function isNotEmpty(o) {
    return (Object.keys(o).length > 0)
  }

  function depth() {
    var depth = self._stack.length
    if (depth > 0 && self._stack[0].array)
      return (depth - 1)
    else
      return depth
  }

  function scope() {
    function pointer(state) {
      if ('key' in state && state.key != '@context') return '/'+state.key
      if ('array' in state) return '/'+state.array.length
      return ''
    }
    return self._stack.map(pointer).join('')
  }

  this._parser.onerror = function(e){
    self.emit('error', e)
  }

  this._parser.onvalue = function(v){
    if (self._state.object) {
      if (self._state.key == '@context') {
        self.emit('context', v, scope())
        self._parsingContext = false
      }
      self._state.object[self._state.key] = v      
    }
    if (self._state.array) 
      self._state.array.push(v)
  }

  this._parser.onopenobject = function(k){
    if (self._state)
      self._stack.push(self._state)
    self._state = { key:k, object:{} }
    if (self._state.key == '@context')
      self._parsingContext = true
  }

  this._parser.onkey = function(k){
    self._state.key = k
    if (self._state.key == '@context')
      self._parsingContext = true
  }

  this._parser.oncloseobject = function(){
    var value = null
    if (self._state.object) {

      if (isURI(self._state.object)) {
        value = self._state.object

      } else if (isGraph(self._state.object)) {
        self.emit('graph', self._state.object)

      } else if (isContext()) {
        self.emit('context', self._state.object, scope())
        self._parsingContext = false

      } else if (self._parsingContext) {
        value = self._state.object

      } else if (isNotEmpty(self._state.object)) {
        if ('@id' in self._state.object) {
          value = { '@id': self._state.object['@id'] }
          self.push(self._state.object)
        } else {
          // only push objects without @ids if they are at the root.
          value = self._state.object
          if (depth() == 0) 
            self.push(self._state.object)
        }
      }

      self._state = self._stack.pop() || null
      if (self._state && value) { 
        if (self._state.array) self._state.array.push(value)
        if (self._state.object) self._state.object[self._state.key] = value
      }
    }
  }

  this._parser.onopenarray = function(){
    if (self._state)
      self._stack.push(self._state)
    self._state = { array:[] }
  }

  this._parser.onclosearray = function(){
    var value = null
    if (self._state.array) {
      
      if (isContext()) {
        self.emit('context', self._state.array, scope())
        self._parsingContext = false
      } else {
        value = self._state.array
      }

      self._state = self._stack.pop() || null
      if (self._state && value) { 
        if (self._state.array) self._state.array.push(value)
        if (self._state.object) self._state.object[self._state.key] = value
      }
    }
  }
}

JSONLDTransform.prototype = Object.create(
  Transform.prototype, { constructor: { value: JSONLDTransform }})

JSONLDTransform.prototype._transform = function(chunk, encoding, done) {
  if (this._parser.closed)
    this.push(null)
  else
    this._parser.write(chunk.toString('utf8'))
  process.nextTick(done)
}

exports.JSONLDTransform = JSONLDTransform
