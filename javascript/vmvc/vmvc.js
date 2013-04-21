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
		defaultNames: 'all', //An array of names of templates and models to load on instantiation, can use 'all' as a value
		errorName: null, //The template/model name to use for errors
		routing: false, //Whether or not routing is enabled; use false for a single page web app with no hash URLs
		routingNames: {}, //Something like {route1: [name1, name2]}, else defaults to 1 to 1 names routing
		modelsUrl: null, //something like path/to/url/api.php?model={{name}} or path/to/url/{{name}}.html else {{name}}Model
		viewsUrl: null, //ditto, but with {{name}}View and {{name}}Target
	},
	
	/**
	 * @param obj - options - The options
	 */
	initialize: function(names, options){
		this.names = names;
		this.setOptions(options);
		
		this._factory(names);
		
		if (this.options.routing){
			this.currentHash = window.location.hash;
		} else {
			Object.each(this.views, function(view, name){
				this._load(name, this.models[name]);
			}, this);
		}
		
		names.each(function(name){
			window.addEvent(name + 'Change', function(model){
				this.models[name] = model;
				this._load(name, this.models[name]);
				this._assignEvents();
			}.bind(this));
		}.bind(this));
		
		this._assignEvents();
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
	_factory: function(names){
		var loaded = (this.options.defaultNames == 'all') ? names : this.options.defaultNames;
		loaded = (this.options.preload == 'all') ? loaded.combine(names) : loaded.combine(this.options.preload);
		
		this.models = {};
		this.views = {};
		
		loaded.each(function(name){
			var model = new Model(name, JSON.decode($(name+'Model').get('html')));
			var view = new View(name);
			this.models[name] = model;
			this.views[name] = view.load().populate(model);
		}, this);		
		
	},
	
	//Loads the appropriate models and views
	_load: function(name){
		if ($(name+'Target')){
			$(name+'Target').set('html', this.views[name].populate(this.models[name]).render());
		}
	},
	
	//Loads the appropriate template from the passed in hash if it exists, else loads the error template -> Consider using the default template here too
	_loadFromHash: function(hash){},
	
	//Poll the hashtag once every 100 ms if routing is enabled !!!! use the hashchange event, but be careful about case in IE
	_pollHash: function(){}, 

	_assignEvents: function(){
		var triggers = $$('[data-action]');
		triggers.each(function(el){
			var action = '_bind' + el.get('data-action').capitalize() + 'Event';
			var model = el.get('data-model');
			this[action](el, model);
		}, this);
	},
	
	_bindAddEvent: function(el, model){
		var source = $(el.get('data-source'));
		if (source){
			var self = this;
			var path = el.get('data-path')+'.push';
			source.removeEvents('submit').addEvent('submit', function(e){
				e.stop();
				
				//Serialize the form
				var data = {};
				var values = this.toQueryString().split('&');
				values.each(function(pair){
					pair = pair.split('=');
					var key = pair[0];
					var value = self._convertValue(pair[1]);
					data[key] = value;
				});
				
				self.models[model].set(path, data);
				this.reset();
				this.focus();
			});
		}
	},
	
	_bindSetEvent: function(el, model){
		el.addEvent(el.get('data-event'), function(e){
			e.stop();
			var path = el.get('data-path');
			var value = this._convertValue(el.get('data-value'));
			this.models[model].set(path, value);
		}.bind(this));		
	},
	
	_bindRemoveEvent: function(el, model){
		el.addEvent(el.get('data-event'), function(e){
			e.stop();
			var path = el.get('data-path');
			this.models[model].remove(path);
		}.bind(this));		
	},
	
	_bindSaveEvent: function(el, model){
		
	},	

	/**
	 * Converts a string to its native type
	 * @param string value - The value to be converted
	 * @return mixed value - The converted value
	 */
	_convertValue: function(value){
		value = decodeURIComponent(value.replace(/\+/g, ' ')).trim();
		if (value === 'true') {return true;}
		if (value === 'false') {return false;}
		if (value === 'null') {return null;}
		if ((!isNaN(parseFloat(value))) && (isFinite(value))){return value.toFloat();}
		if (value.contains('{')||value.contains('[')){return (JSON.decode(value, true)) ? JSON.decode(value) : value;}
		return value;
	},
	
	/**
	 * @param string name - The name of the model to retrieve
	 * @return The named model for manipulation
	 */
	get: function(name){
		return (Object.keys(this.models).contains(name)) ? this.models[name] : false;
	}, 
	
	//Replaces the stored model with a new one, name can be gotten automatically (names[0]) -> This could be called automatically on the model change event
	set: function(model){},
	
	//Creates a new model/view pair, with the option to reuse a view template
	add: function(name, modelData, viewPrototypeName){},
	
	//Clones both view and model prototypes and assigns a new name
	clone: function(name, prototypeName, modelData){},
	
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
		window.fireEvent(this.names[0] + 'Change', this);
		return this;
	},
	
	remove: function(key){
		this._parseKey(key, null, true);
		window.fireEvent(this.names[0] + 'Change', this);
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

	setFilter: function(filter){
		this.filter = filter;
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

				if (typeOf(value) !== 'undefined'){
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
			if (value){this.data = data = value;}
			if (remove){this.data = data = {};}
		}		
		return data;
	},
	
	//Arrays are automatically pruned of undefined or null values and their indices are reset 
	//This is done to prevent issues for sorting and counts, so do not use the array index as a permanent unique identifier
	_cleanArrays: function(data){
		data = (typeOf(data) !== 'null') ? data : this.data;
		if ((toString.call(data) === '[object Array]')||(typeOf(data) === 'object')){
			if (toString.call(data) === '[object Array]'){
				data = data.clean();

				data.each(function(value, key){
					data[key] = this._cleanArrays(value) 
				}, this);
			} else {
				Object.each(data, function(value, key){
					if ((toString.call(value) === '[object Array]')||(typeOf(value) === 'object')){
						data[key] = this._cleanArrays(value)
					} else {
						data[key] = value;
					}			
				}, this);				
			}
		}
		return data;
	}
});

var View = new Class({
	
	customTags: {},
	placeholderFunctions: ['_evaluateIf'],
	arrayFunctions: ['_evaluateIf', '_count', '_first', '_last', '_random', '_add', '_remove', '_set'],
	arrayItemFunctions: ['_remove', '_set'],
	objectFunctions: ['_evaluateIf', '_remove', '_set'],
	
	initialize: function(name){
		if (typeOf(name) !== 'string') throw new Error('Model name parameter must be a string');
		this.name = name;
	},
	
	load: function(template){
		if (template){
			this.template = template;
		} else {
			if (!this.template){
				if ($(this.name+'View')){
					this.template = $(this.name+'View').get('html').toString();
				} else {
					//load via AJAX -- We may want this to be synchronous, but maybe not
				}
			}
		}
		return this;
	},
	
	populate: function(model){
		this.populatedTemplate = this._save(this._removeComments(this.template));

		if (toString.call(model) === '[object Array]'){
			this.populatedTemplate = this._parseArray(this.populatedTemplate, 'this', model);
		} else if (typeOf(model) === 'object'){
			this.populatedTemplate = this._parseObject(this.populatedTemplate, 'this', model);
		} else {
			this.populatedTemplate = this._parsePlaceholder(this.populatedTemplate, 'this', model);
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
				listItemTemplate = this._runTagFunctions(listTemplate, key, value, this.arrayItemFunctions, index);
				if (toString.call(item) === '[object Array]'){
					list.push(this._parseArray(listItemTemplate, key, item));
				} else if (typeOf(item) === 'object'){
					list.push(this._parseObject(listItemTemplate, null, item));
				} else {
					list.push(this._parsePlaceholder(listItemTemplate, 'this', item));
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
			value = Object.clone(value.get());
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

	_runTagFunctions: function(template, key, value, functions, index){
		functions.each(function(funk){
			template = (typeOf(this[funk]) === 'function') ? this[funk](template, key, value, index) : this.customTags[funk](template, key, value, index);
		}, this);
		return template;
	},
	
	//Private
	_evaluateIf: function(template, key, value){
		if ((template.contains('{{if '))&&(key)){		
			if (toString.call(value) === '[object Array]'){
				var valid = (value.length > 0);
			} else if (typeOf(value) === 'object'){	
				var valid = (Object.getLength(value) > 0);
			} else {
				var valid = ((value !== null)&&(value !== false)&&(value !== ''));
			}

			if (template.contains('{{if '+key.trim()+'}}')){ //Normal if statement
				var regex = new RegExp('{{if '+key.trim()+'}}((.|\n)*?){{/if '+key.trim()+'}}');
				var ifTemplate = (template.match(regex)) ? template.match(regex)[1].trim() : template;

				if (ifTemplate.contains('{{else !'+key.trim()+'}}')){
					ifTemplate = (valid) ? ifTemplate.split('{{else !'+key.trim()+'}}')[0] : ifTemplate.split('{{else !'+key.trim()+'}}')[1];
				} else {
					ifTemplate = (valid) ? ifTemplate : '';
				}
				template = template.replace(regex, ifTemplate);
			} else if (template.contains('{{if !'+key.trim()+'}}')){ //The if negation statement
				var regex = new RegExp('{{if !'+key.trim()+'}}((.|\n)*?){{/if}}');
				var ifTemplate = (template.match(regex)) ? template.match(regex)[1].trim() : template;
				
				if (ifTemplate.contains('{{else'+key+'}}')){
					ifTemplate = (!valid) ? ifTemplate.split('{{else'+key+'}}')[0] : ifTemplate.split('{{else'+key+'}}')[1];
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
	
	render: function(raw){
		return (raw) ? this.template : this.populatedTemplate;
	},	
	
	//Tag functions

	/**
	 * Replaces the {{count path}} tag with the number of items in the 'path' array. Only to be used for arrays.
	 * @param string template - The template to be evaluated.
	 * @param string key - The current key.
	 * @param mixed value - The value of the current key.
	 */	
	_count: function(template, key, value){
		return this._evaluateSingleTag(template, key, value.clean().length, 'count');
	},

	/**
	 * Replaces the {{first path}} tag with the value of the first item in the 'path' array. Only to be used for arrays.
	 * @param string template - The template to be evaluated.
	 * @param string key - The current key.
	 * @param mixed value - The value of the current key.
	 */	
	_first: function(template, key, value){
		return this._evaluateMatchedTag(template, key, value[0], 'first');
	},

	/**
	 * Replaces the {{last path}} tag with the value of the last item in the 'path' array. Only to be used for arrays.
	 * @param string template - The template to be evaluated.
	 * @param string key - The current key.
	 * @param mixed value - The value of the current key.
	 */		
	_last: function(template, key, value){
		return this._evaluateMatchedTag(template, key, value[value.length - 1], 'last');
	},

	/**
	 * Replaces the {{random path}} tag with the value of a random item in the 'path' array. Only to be used for arrays.
	 * @param string template - The template to be evaluated.
	 * @param string key - The current key.
	 * @param mixed value - The value of the current key.
	 */		
	_random: function(template, key, value){
		var random = Number.random(0, value.length - 1);
		return this._evaluateMatchedTag(template, key, value[random], 'random');
	},
	
	//Event tags
	
	/**
	 * Adds data attributes to signal that a form submission event should add to a model's index. The format is
	 * {{add path from formId}}. It is best placed on an ol or ul list element.
	 * @param string template - The template to be evaluated.
	 * @param string key - The key to be found. May be entered as a full model path.
	 */
	_add: function(template, key){
		var regex = new RegExp('{{add ((.)*?'+key.trim()+') from ((.)*?)}}');
		var path = (template.match(regex)) ? template.match(regex)[1] : false;
		if (path){
			var sourceId = (template.match(regex)) ? template.match(regex)[3] : false;
			var attributes = 'data-action="add" data-path="'+path.trim()+'" data-source="'+sourceId+'" data-model="'+this.name+'"';
			template = this._evaluateSingleTag(template, ' '+path+' from '+sourceId, attributes, 'add');
		}
		return template;
	},

	/**
	 * Adds data attributes to signal that an item should be removed from the model on a specified event. The format is
	 * {{remove path on event}}. For array items, substitute the word 'index' for the array index number and it will be 
	 * automatically replaced with the proper index.
	 * @param string template - The template to be evaluated.
	 * @param string key - The key to be found. May be entered as a full model path.
	 * @param mixed value - The value is not used in this function and can be ignored
	 * @param int index - [optional] The array index if the current item is an array
	 */
	_remove: function(template, key, value, index){
		if (key){
			var regex = new RegExp('{{remove ((.)*?'+key.trim()+'(.)*?) on ((.)*?)}}');
			var path = (template.match(regex)) ? template.match(regex)[1] : false;
			if (path){
				if (((path.contains('index')) && (typeOf(index) !== 'null'))||(!path.contains('index'))){
					var indexPath = path.replace('index', index);
					var event = (template.match(regex)) ? template.match(regex)[4] : false;
					var attributes = 'data-action="remove" data-path="'+indexPath.trim()+'" data-event="'+event+'" data-model="'+this.name+'"';
					template = this._evaluateSingleTag(template, ' '+path.trim()+' on '+event, attributes, 'remove');
				}
			}
		}
		return template;
	},

	/**
	 * Adds data attributes to signal that an item's value should be set in the model on a specified event. The format 
	 * is {{set path to value on event}}. For array items, substitute the word 'index' for the array index number and 
	 * it will be automatically replaced with the proper index.
	 * @param string template - The template to be evaluated.
	 * @param string key - The key to be found. May be entered as a full model path.
	 * @param mixed value - The value is not used in this function and can be ignored
	 * @param int index - [optional] The array index if the current item is an array
	 */	
	_set: function(template, key, value, index){
		if (key){
			var regex = new RegExp('{{set ((.)*?'+key.trim()+'(.)*?) to ((.)*?) on ((.)*?)}}');
			var path = (template.match(regex)) ? template.match(regex)[1] : false;
			if (path){
				if (((path.contains('index')) && (typeOf(index) !== 'null'))||(!path.contains('index'))){
					var indexPath = path.replace('index', index);
					var newValue = (template.match(regex)) ? template.match(regex)[4] : false;
					var event = (template.match(regex)) ? template.match(regex)[6] : false;
					var attributes = 'data-action="set" data-path="'+indexPath.trim()+'" data-value="'+newValue+'" data-event="'+event+'" data-model="'+this.name+'"';					
					template = this._evaluateSingleTag(template, ' '+path.trim()+' to '+newValue+' on '+event, attributes, 'set');

					//Rerun it if there are multiple values to be set
					template = (template.match(regex)) ? this._set(template, key, value, index) : template; 
				}
			}			
		}
		return template;
	},

	/**
	 * Adds data attributes to signal that the current model should be saved on the given event. The format is 
	 * {{save modelName on event}}.
	 * @param string template - The template to be evaluated.
	 */		
	_save: function(template){
		var regex = new RegExp('{{save ((.)*?) on ((.)*?)}}');
		var values = template.match(regex);
		if (values){
			var attributes = 'data-action="save" data-model="'+values[1]+'" data-event="'+values[3]+'"';
			template = this._evaluateSingleTag(template, ' '+values[1]+' on '+values[3], attributes, 'save');
			
			//Rerun it if there are multiple values to be set
			template = (template.match(regex)) ? this._save(template) : template;			
		}
		return template;
	}
});