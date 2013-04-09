/**
* @author Virtuosi Media
* @link http://www.virtuosimedia.com
* @copyright Copyright (c) 2013, Virtuosi Media
* @license: MIT License
* @description: A small MVC library for JavaScript applications
* Requirements: MooTools 1.4 Core - See http://mootools.net
*/
var Controller = new Class({

	Implements: [Events, Options],

	options: {
		asynch: false, //Choose whether or not templates and models are loaded asynchronously
		preload: [], //The names of templates and models to preload, can use 'all' as a value 
		defaultNames: [], //The names of templates and models to load on instantiation, can use 'all' as a value
		errorName: null, //The template/model name to use for errors
		routing: false,
		routingNames: {}, //Something like {route1: [name1, name2]}, else defaults to 1 to 1 names routing
		modelsUrl: null, //something like path/to/url/api.php?model={{name}} or path/to/url/{{name}}.html else ${{name}}ModelSource
		viewsUrl: null, //ditto, but with ${{name}}ViewSource and ${{name}}Target
	},
	
	/**
	 * @param obj - options - The options
	 */
	initialize: function(names, options){
		console.log('loaded');
		this.currentHash = window.location.hash;
	},
	
	//Model name, view name must be the same
	//The source URL will query the name
	//The source ID will query the name
	//The target ID will use the name
	//The routing hash tag will use the name - You might want to be careful about associated names to hashtags as this is a little simplistic
	//and there easily could be use cases where you want to use multiple names, but only a few hashtags
	
	//Figure out a way to avoid template/model duplication. If they are reused, they shouldn't have to be retrieved twice. However, it may be 
	//safer to retrieve models multiple times. Perhaps views could be inserted into the page under an ID after being retrieved, with the ID 
	//being checked before the view is fetched via URL - This might be better done in the load function of the View class. It would be nice for a 
	//View to be used by multiple names...

	//Creates all views and models
	_factory: function(){},
	
	//Loads the appropriate models and views
	_load: function(names){},
	
	//Loads the appropriate template from the passed in hash if it exists, else loads the error template
	_loadFromHash: function(hash){},
	
	//Poll the hashtag once every 100 ms if routing is enabled !!!! use the hashchange event, but be careful about case in IE
	_pollHash: function(){}, 
	
	//Retrieves the model for manipulation
	get: function(name){}, 
	
	//Replaces the stored model with a new one, name can be gotten automatically (names[0])
	set: function(model){},
	
	//Save the model name to the modelsUrl via POST or 'all' for all models
	save: function(name){}, 
});

var Model = new Class({
	
	initialize: function(name, defaultData, filter){
		if (typeOf(name) !== 'string') throw new Error('Model name parameter must be a string');
		if ((defaultData) && (typeOf(defaultData) !== 'object')) throw new Error('Model defaultData parameter must be an object');
		if ((filter) && (typeOf(filter) !== 'function')) throw new Error('Model filter parameter must be a function');
		
		this.names = [name];
		this.data = defaultData;
		this.filter = (filter) ? filter : function(value){return value;};
	},
	
	get: function(key){
		return this._parseKey(key);
	},	
	
	set: function(key, value){
		var data = this._parseKey(key, this.filter(value));
		if ((typeOf(value) === 'object') && (Object.keyOf(window, value.constructor) == 'Model')){
			Array.each(value.getNames(), function(name){
				this.names.push(name);	
			}, this);
		}
		window.fireEvent('model-change-' + this.name);
		return this;
	},
	
	remove: function(key){
		this._parseKey(key, null, true);
		window.fireEvent('model-change-' + this.name);
		return this;
	},
		
	getNames: function(){
		return this.names;
	},
	
	serialize: function(data){
		data = (data) ? data : this.data;
		var copy = {};
		Object.each(data, function(value, key){
			if ((typeOf(value) === 'object') && (Object.keyOf(window, value.constructor) == 'Model')){
				value = this.serialize(value.get());
			}
			copy[key] = value;
		}, this);
		return JSON.encode(copy);
	},
	
	_parseKey: function(key, value, remove){
		var data = this.data;
		
		if (key){
			var children = key.split('.');
			var numChildren = children.length - 1;
	
			if (numChildren > 0){
				for (var i = 0; i < numChildren; i++){
					data = data[children[i]];
				}
				
				if (value){
					//The push syntax allows for a value to be pushed on to the end of an array
					var index = (children[numChildren] == 'push') ? data.length : children[numChildren];
					data[index] = value;
				}
				if (remove){delete data[children[numChildren]];}
				if (toString.call(data) === '[object Array]'){this._cleanArrays();}
			} else {
				if (value){this.data[key] = value;}
				data = this.data[key];
				if (remove){delete data[key];}				
			}
		} else {
			if (remove){data = {};}
		}		
		return data;
	},
	
	//Arrays are automatically pruned of undefined or null values and their indices are reset 
	//This is done to prevent issues for sorting and counts, so do not use the array index as a permanent unique identifier
	_cleanArrays: function(data){
		data = (data) ? data : this.data;
		if ((toString.call(data) === '[object Array]')||(typeOf(data) === 'object')){
			if (toString.call(data) === '[object Array]'){
				data = data.clean();
				
				data.each(function(value, key){
					data[key] = this._cleanArrays(value) 
				}, this);
			} else {
				Object.each(data, function(value, key){
					data[key] = this._cleanArrays(value) 
				}, this);				
			}
		}
		return data;
	}
});

var View = new Class({
	
	customTags: {},
	placeholderFunctions: ['_evaluateIf'],
	arrayFunctions: ['_evaluateIf', '_count', '_first', '_last', '_random'],
	objectFunctions: ['_evaluateIf'],
	
	initialize: function(name){
		if (typeOf(name) !== 'string') throw new Error('Model name parameter must be a string');
		this.name = name;
	},
	
	load: function(){
		if (!this.template){
			if (this.source.substr(0, 1) === '#'){
				this.template = $$(this.source)[0].get('html').toString();
			} else {
				//load via AJAX -- We may want this to be synchronous, but maybe not
			}
		}
		return this;
	},
	
	populate: function(model){
		this.template = this._removeComments(this.template);
		
		if (toString.call(model) === '[object Array]'){
			this.populatedTemplate = this._parseArray(this.template, 'this', model);
		} else if (typeOf(model) === 'object'){
			this.populatedTemplate = this._parseObject(this.template, 'this', model);
		} else {
			this.populatedTemplate = this._parsePlaceholder(this.template, 'this', model);
		}
		return this;
	},
	
	//Private
	_parsePlaceholder: function(template, key, value){
		template = this._runTagFunctions(template, key, value, this.placeholderFunctions);
		var regex = new RegExp('{{'+key+'}}', 'g');
		return (template.contains('{{'+key+'}}')) ? template.replace(regex, value) : template;
	},

	//Private
	_parseArray: function(template, key, value){
		template = this._runTagFunctions(template, key, value, this.arrayFunctions);
		var regex = new RegExp('{{list'+key+'}}((.|\n)*?){{/list}}');
		
		if (template.match(regex)){ 
			var listTemplate = template.match(regex)[1].trim();
			var list = [];
			value.each(function(item, index){
				if (toString.call(item) === '[object Array]'){
					list.push(this._parseArray(listTemplate, key, item));
				} else if (typeOf(item) === 'object'){
					list.push(this._parseObject(listTemplate, null, item));
				} else {
					list.push(this._parsePlaceholder(listTemplate, 'this', item));
				}
				list[index] = this._parsePlaceholder(list[index], 'index'+key, index + 1);
			}, this);
			template = template.replace(regex, list.join(''));
		}
		return template;
	},
	
	//Private
	_parseObject: function(template, key, value){
		if (Object.keyOf(window, value.constructor) == 'Model'){
			value = value.get();
		}

		template = this._runTagFunctions(template, key, value, this.objectFunctions);
		
		Object.each(value, function(subvalue, subkey){
			if (toString.call(subvalue) === '[object Array]'){
				template = this._parseArray(template, ' '+subkey, subvalue);
			} else if (typeOf(subvalue) === 'object'){
				template = this._parseObject(template, ' '+subkey, subvalue);				
			} else { 
				template = this._parsePlaceholder(template, subkey, subvalue);
			}
		}, this);
		
		return template;
	},

	_runTagFunctions: function(template, key, value, functions){
		functions.each(function(funk){
			template = (typeOf(this[funk]) === 'function') ? this[funk](template, key, value) : this.customTags[funk](template, key, value);
		}, this);
		return template;
	},
	
	//Private
	_evaluateIf: function(template, key, value){
		if (template.contains('{{if ')){		
			if (toString.call(value) === '[object Array]'){
				var valid = (value.length > 0);
			} else if (typeOf(value) === 'object'){	
				var valid = (Object.getLength(value) > 0);
			} else {
				var valid = ((value !== null)&&(value !== false)&&(value !== ''));
			}
			
			if (template.contains('{{if'+key+'}}')){ //Normal if statement
				var regex = new RegExp('{{if'+key+'}}((.|\n)*?){{/if}}');
				var ifTemplate = (template.match(regex)) ? template.match(regex)[1].trim() : template;
				
				if (ifTemplate.contains('{{else}}')){
					ifTemplate = (valid) ? ifTemplate.split('{{else}}')[0] : ifTemplate.split('{{else}}')[1];
				} else {
					ifTemplate = (valid) ? ifTemplate : '';
				}
				
				template = template.replace(regex, ifTemplate);
			} else if (template.contains('{{if !'+key.trim()+'}}')){ //The if negation statement
				var regex = new RegExp('{{if !'+key.trim()+'}}((.|\n)*?){{/if}}');
				var ifTemplate = (template.match(regex)) ? template.match(regex)[1].trim() : template;
				
				if (ifTemplate.contains('{{else}}')){
					ifTemplate = (!valid) ? ifTemplate.split('{{else}}')[0] : ifTemplate.split('{{else}}')[1];
				} else {
					ifTemplate = (!valid) ? ifTemplate : '';
				}
				template = template.replace(regex, ifTemplate);
			} 	
		} 
		
		return template;
	},

	_evaluateSingleTag: function(template, key, value, regex){
		var regex = new RegExp('{{'+regex+key+'}}', 'g');
		return (template.match(regex)) ? template.replace(regex, value).trim() : template;
	},	
	
	_evaluateMatchedTag: function(template, key, value, tag){
		var regex = new RegExp('{{'+tag+key+'}}((.|\n)*?){{/'+tag+'}}');
		var tagTemplate = (template.match(regex)) ? template.match(regex)[1].trim() : template;
		if (toString.call(value) === '[object Array]'){
			tagTemplate = this._parseArray(tagTemplate, key, value);
		} else if (typeOf(value) === 'object'){
			tagTemplate = this._parseObject(tagTemplate, null, value);
		} else {
			tagTemplate = this._parsePlaceholder(tagTemplate, 'this', value);
		}
		return template.replace(regex, tagTemplate);
	},	
	
	_removeComments: function(template){
		return this._evaluateSingleTag(template, '', '', '#((.|\n)*?)');		
	},

	defineTag: function(name, dataTypes, fn){
		dataTypes = (toString.call(dataTypes) === '[object Array]') ? dataTypes : [dataTypes];
		dataTypes.each(function(type){
			if (type == 'placeholder'){
				this.placeholderFunctions.push(name);
			} else if (type == 'array'){
				this.arrayFunctions.push(name);
			} else if (type == 'object'){
				this.objectFunctions.push(name);
			}
		}, this);
		this.customTags[name] = fn.bind(this);
	},
	
	render: function(){
		return this.populatedTemplate;
	},	
	
	//Tag functions
	
	_count: function(template, key, value){
		return this._evaluateSingleTag(template, key, value.clean().length, 'count');
	},
	
	_first: function(template, key, value){
		return this._evaluateMatchedTag(template, key, value[0], 'first');
	},

	_last: function(template, key, value){
		return this._evaluateMatchedTag(template, key, value[value.length - 1], 'last');
	},
	
	_random: function(template, key, value){
		var random = Number.random(0, value.length - 1);
		return this._evaluateMatchedTag(template, key, value[random], 'random');
	}
});