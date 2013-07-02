var JSONLDTransform = require('../lib/jsonldtransform').JSONLDTransform
  , Writable = require('stream').Writable
  , util = require('util')
  , fs = require('fs')

module.exports = 
  { setUp: function(callback) {
      var self = this
      self.transform = new JSONLDTransform()
      self.check = new Writable({objectMode:true})
      self.expect = function(test, expecting) {
        self.test = test
        self.expecting = expecting
        self.test.expect(self.expecting.filter(function(v){ 
          return (v !== '~') 
        }).length)
      }
      function checknext(o) {
        var expected = self.expecting.shift()
        if (expected === '~') {
          self.test.deepEqual(o['@id'], self.expecting.shift()['@id'])
        } else {
          self.test.deepEqual(o, expected)
        }
        if (self.expecting.length == 0) self.test.done()
      }
      self.check._write = function(o, ignore, callback) {
        checknext(o)
        callback()
      }
      self.transform.on('context', function(o, scope){
        checknext('context')
        checknext(o)
        checknext(scope)
      })
      self.transform.on('graph', function(o){
        checknext('graph')
        checknext(o)
      })
      self.transform.on('readable', function(){
        checknext('readable')
      })
      self.transform.on('pipe', function(){
        checknext('pipe')
      })
      self.transform.on('finish', function(){
        checknext('finish')
      })
      self.transform.on('end', function(){
        checknext('end')
      })
      self.transform.on('error', function(e){
        self.test.ifError(e)
      })
      callback()
    }
//------------------------------------------------------------------------------
  , 'plain JSON': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'readable'
        , { "name": "Manu Sporny"
          , "homepage": "http://manu.sporny.org/"
          , "image": "http://manu.sporny.org/images/manu.png"
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/plain_json.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'simple JSON-LD': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'readable'
        , { "http://schema.org/name": "Manu Sporny"
          , "http://schema.org/url": { "@id": "http://manu.sporny.org/" }
          , "http://schema.org/image": { "@id": "http://manu.sporny.org/images/manu.png" }
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/simple_jsonld.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'just context': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'context'
        ,  { "name": "http://schema.org/name"
           , "image": 
             { "@id": "http://schema.org/image"
             , "@type": "@id"
             }
           , "homepage": 
             { "@id": "http://schema.org/url"
             , "@type": "@id"
             }
           }
        , '' // whole document scope
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/just_context.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'referenced context': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'context'
        , 'http://json-ld.org/contexts/person.jsonld'
        , '' // whole document scope
        , 'readable'
        , { "name": "Manu Sporny"
          , "homepage": "http://manu.sporny.org/" 
          , "image": "http://manu.sporny.org/images/manu.png"
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/referenced_context.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'inline context': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'context'
        ,  { "name": "http://schema.org/name"
           , "image": 
             { "@id": "http://schema.org/image"
             , "@type": "@id"
             }
           , "homepage": 
             { "@id": "http://schema.org/url"
             , "@type": "@id"
             }
           }
        , '' // whole document scope
        , 'readable'
        , { "name": "Manu Sporny"
          , "homepage": "http://manu.sporny.org/"
          , "image": "http://manu.sporny.org/images/manu.png"
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/inline_context.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'multiple contexts': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'context'
        , 'http://example.org/contexts/person.jsonld'
        , '/0' // scope
        , 'readable'
        , { "name": "Manu Sporny"
          , "homepage": "http://manu.sporny.org/" 
          , "depiction": "http://twitter.com/account/profile_image/manusporny"
          }
        , 'context'
        , 'http://example.org/contexts/place.jsonld'
        , '/1' // scope
        , 'readable'
        , { "name": "The Empire State Building"
          , "description": "The Empire State Building is a 102-story landmark in New York City." 
          , "geo": { "latitude": "40.75", "longitude": "73.98" }
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/multiple_contexts.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'scoped contexts': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'context'
        , { "name": "http://example.com/person#name"
          , "details": "http://example.com/person#details"
          }
        , '' // whole document scope
        , 'context'
        , { "name": "http://example.com/organization#name" }
        , '/details' // object scope
        , 'readable'
        , { "name": "Markus Lanthaler"
          , "details": 
            { "name": "Graz University of Technology" }
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/scoped_contexts.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'combined external and local contexts': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'context'
        , [ "http://json-ld.org/contexts/person.jsonld"
          , { "pic": "http://xmlns.com/foaf/0.1/depiction" }
          ]
        , '' // whole document scope
        , 'readable'
        , { "name": "Manu Sporny"
          , "homepage": "http://manu.sporny.org/"
          , "pic": "http://twitter.com/account/profile_image/manusporny"
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/combined_external_and_local_contexts.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'language map': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'context'
        , { "occupation": 
            { "@id": "ex:occupation", "@container": "@language" } 
          }
        , '' // whole document scope
        , 'readable'
        , { "name": "Yagyū Muneyoshi"
          , "occupation":
            { "ja": "忍者"
            , "en": "Ninja"
            , "cs": "Nindža"
            }
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/language_map.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'set multiple values': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'readable'
        , { "@id": "http://example.org/articles/8"
          , "dc:title": 
            [ { "@value": "Das Kapital"
              , "@language": "de"
              }
            , { "@value": "Capital"
              , "@language": "en"
              }
            ]
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/set_multiple_values.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'named graph': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'readable'
        , { '@id': '/topicnode/666'
          , '@type': 'http://www.wikidata.org/wiki/Q215627'
          , 'name': 'Emma Goldman'
          , 'place of birth': 'http://www.wikidata.org/wiki/Q4115712' 
          }
        , 'readable'
        , { '@id': 'http://www.wikidata.org/wiki/Q4115712'
          , '@type': 'http://www.wikidata.org/wiki/Q2221906'
          , 'name': 'Kaunas' 
          }
        , 'graph'
        , { '@id': '/_graphs/test-graph-1'
          , '@graph': 
              [ { '@id': '/topicnode/666' }
              , { '@id': 'http://www.wikidata.org/wiki/Q4115712' }
              ]
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/named_graph.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'default graph': function(test) {
      this.expect(test,
        [ 'pipe'
        , 'readable'
        , { '@id': 'http://manu.sporny.org/i/public'
          , '@type': 'foaf:Person'
          , 'name': 'Manu Sporny'
          , 'knows': 'http://greggkellogg.net/foaf#me' 
          }
        , 'readable'
        , { '@id': 'http://greggkellogg.net/foaf#me'
          , '@type': 'foaf:Person'
          , 'name': 'Gregg Kellogg'
          , 'knows': 'http://manu.sporny.org/i/public'
          }
        , 'graph'
        , { '@graph': 
            [ { '@id': 'http://manu.sporny.org/i/public' }
            , { '@id': 'http://greggkellogg.net/foaf#me' }
            ]
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/default_graph.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  , 'DPLA items': function(test) {
      var context = 
        { edm: "http://www.europeana.eu/schemas/edm/"
        , isShownAt: "edm:isShownAt"
        , dpla: "http://dp.la/terms/"
        , dataProvider: "edm:dataProvider"
        , aggregatedDigitalResource: "dpla:aggregatedDigitalResource"
        , state: "dpla:state"
        , hasView: "edm:hasView"
        , provider: "edm:provider"
        , collection: "dpla:aggregation"
        , object: "edm:object"
        , stateLocatedIn: "dpla:stateLocatedIn"
        , begin: 
          { "@type": "xsd:date"
          , "@id": "dpla:dateRangeStart"
          }
        , "@vocab": "http://purl.org/dc/terms/"
        , LCSH: "http://id.loc.gov/authorities/subjects"
        , sourceResource: "edm:sourceResource"
        , name: "xsd:string"
        , coordinates: "dpla:coordinates"
        , end: 
          { "@type": "xsd:date"
          , "@id": "dpla:end"
          }
        , originalRecord: "dpla:originalRecord"
        }
      var contributor =
        { "@id": "http://dp.la/api/contributor/harvard"
        , name: "Harvard Library"
        }
      var collection =
        { id: "f40fbd0146df61aca1628575d1140626"
        , description: "This collection provides descriptions of and digital access to over 3,500 daguerreotypes housed in libraries, museums, and archives at Harvard University. The first publicly announced photographic process, the daguerreotype was introduced by Louis Jacques Mandé Daguerre in 1839"
        , title: "Daguerreotypes at Harvard"
        , "@id": "http://dp.la/api/collections/f40fbd0146df61aca1628575d1140626"
        }
      this.expect(test,
        [ 'pipe'
        , 'context'
        , context
        , '/docs/0' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/a1c79d745f188db2bd9ffba25e235801" }
        , 'context'
        , context
        , '/docs/1' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/5d4aa522af31e52646af5272832b146a" }
        , 'context'
        , context
        , '/docs/2' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/639447d924a14201a0a4135750c7a004" }
        , 'context'
        , context
        , '/docs/3' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/05c16920e24e28a11e189dc4106687ca" }
        , 'context'
        , context
        , '/docs/4' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/1b08d3f45792e4c74b347b10ef4576f0" }
        , 'context'
        , context
        , '/docs/5' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/a96158899d34d6d1a1dc46041fcf00f5" }
        , 'context'
        , context
        , '/docs/6' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/736761748c1b25df7a681a6aaeed3480" }
        , 'context'
        , context
        , '/docs/7' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/c9328573ae646bb5d32c55ba88eadc14" }
        , 'context'
        , context
        , '/docs/8' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/08e7a509672ef137c786d1b05b596581" }
        , 'context'
        , context
        , '/docs/9' // object scope
        , 'readable'
        , contributor
        , 'readable'
        , collection
        , 'readable'
        , '~'
        , { "@id": "http://dp.la/api/items/c4ea019a0108e5b5aae4d92dcc8520bd" }
        , 'readable'
        , { count: 2518842
          , start: 0
          , limit: 10
          , docs: 
              [ { '@id': 'http://dp.la/api/items/a1c79d745f188db2bd9ffba25e235801' }
              , { '@id': 'http://dp.la/api/items/5d4aa522af31e52646af5272832b146a' }
              , { '@id': 'http://dp.la/api/items/639447d924a14201a0a4135750c7a004' }
              , { '@id': 'http://dp.la/api/items/05c16920e24e28a11e189dc4106687ca' }
              , { '@id': 'http://dp.la/api/items/1b08d3f45792e4c74b347b10ef4576f0' }
              , { '@id': 'http://dp.la/api/items/a96158899d34d6d1a1dc46041fcf00f5' }
              , { '@id': 'http://dp.la/api/items/736761748c1b25df7a681a6aaeed3480' }
              , { '@id': 'http://dp.la/api/items/c9328573ae646bb5d32c55ba88eadc14' }
              , { '@id': 'http://dp.la/api/items/08e7a509672ef137c786d1b05b596581' }
              , { '@id': 'http://dp.la/api/items/c4ea019a0108e5b5aae4d92dcc8520bd' }
              ]
          , facets: [] 
          }
        , 'finish' // done writing
        , 'end'    // done reading
        ])
      fs.createReadStream('test/data/dpla_items.json')
        .pipe(this.transform).pipe(this.check)
    }
//------------------------------------------------------------------------------
  }
