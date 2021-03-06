/*
 The MIT License (MIT)

 Copyright (c) 2013 Kazah Dauda <kazah.a.dauda@gmail.com> (http://github.com/k-dauda/)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.

 */

(function () {

    'use strict';

    if (!window.localStorage) {
        // local/session storage not supported
        return;
    }

    /**
     *    PRIVATE METHODS AND VARIABLES
     */

    var _version            = '1.0.0',
        _prefix             = 'ss::',
        _reqPrefix          = 'req::',
        _daysInMillisecs    = 86400000,
        _cachingDisabled    = false,
        _appKey             = 'appVer',
        _undefined          = void 0,
        _save               = 'SAVE',
        _get                = 'GET',
        _post               = 'POST',
        _put                = 'PUT',
        _delete             = 'DELETE',
        _options            = {
            noExpiry           : false,             // default flag to indicate permanent item that should never expire
            autoExpiry         : true,              // default flag to clean specific store entries after x number of days
            autoClean          : true,              // default flag to clean store after x number of days or after version upgrade
            attrAccessor       : '.',               // default operator to access resource attributes
            useSession         : false,             // default flag to indicate type of storage to save item in
            expiry             : 15,                // default expiry of items is 15 days
            cleanInterval      : 30,                // default interval of 30 days used for cleaning store
            unmodStatus        : 304,               // server response indicating that a cached item is still valid ie data is unmodified
            method             : _get,              // default request method
            useHashFunc        : false,             // default flag to indicate the use of the hash function over the hash property
            params             : {},                // default parameters object for requests
            headers            : {},                // default headers object for requests
            extract            : '',                // default property to extract data from server response
            hashProp           : 'hash',            // property for unique item hash/version for server validation - sent with request for updated or new values
            saveParams         : true,              // default flag to save request params
            useTransform       : false,             // default flag to use transform method over extract param
            transform          : function(){},      // method to use to transform return data
            hashResolver       : function(){},      // method to use to calculate item hash
            callBack           : function(){}       // method to use to return data from ajax request
        },

        /**
         * simple wrapper for store key
         *
         * @param key - key to store item in store with
         * @return  {string} wrapped storage key
         * @private
         */
        _wrapKey = function (key) {
            return _prefix+key;
        },

        /**
         * simple trim implementation for IE8 support
         *
         * @param value - value to trim
         * @private
         */
        _trim = function (value) {
            return value.replace(/^\s+|\s+$/g, '');
        },

        /**
         * method used to check if an object has properties
         *
         * @param obj - Object to check
         * @return {boolean}
         * @private
         */
        _isEmpty = function (obj) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    return false;
                }
            }

            return true;
        },

        /**
         * Used to extend objects
         *
         * @param objA - object to extend
         * @param objB - object to extend from
         * @private
         */
        _extend = function (objA, objB) {
            for (var key in objB) {
                if (objB.hasOwnProperty(key)) {
                    objA[key] = objB[key];
                }
            }

            return objA;
        },

        /**
         * method used to set up options object with default values if they haven't been set
         * or they've been set with invalid value
         *
         * @param options - options object
         * @private
         */
        _setDefaultOptions = function (options) {
            for (var key in _options) {
                if (_options.hasOwnProperty(key)) {
                    var defaultValue = _options[key],
                        setValue = options[key];
                    if (setValue === _undefined) {
                        // if option value hasn't been set, set it to default value
                        options[key] = defaultValue;
                    }
                    else {
                        // if option is set to wrong type
                        // overwrite value with default
                        if (typeof setValue !== typeof defaultValue) {
                            options[key] = defaultValue;
                        }
                    }
                }
            }

            options.ready = true;
        },

        /*
         * returns the keys of all the items stored by simple store
         *
         * @return {array} array containing all keys stored by simple store
         */
        _getKeys = function () {
            var keys = [];
            for (var key in localStorage) {
                if (key.indexOf(_prefix) !== -1) {
                    keys.push(key);
                }
            }

            return keys;
        },

        /**
         * Used to update an apps version and cleans out data that was stored for an old version
         *
         * @param version - version to store
         * @private
         */
        _updateAppVersion = function (version) {
            if (!version || typeof version !== 'string') {
                throw new Error('must provide new app version of type string');
            }

            var oldVersion = get(_appKey);
            // compare versions and clear if not the same
            if (oldVersion !== version) {
                clear();
            }

            // update app version to latest
            update(_appKey, version, { noExpiry: true });
        },

        /**
         * Used to update the timestamp of a stored item
         *
         * @param key       - key of item in store to touch
         * @param [options] - options object
         * @param item      - item to touch in storage
         * @private
         */
        _touch = function(key, options, item) {
            options = options || {};

            if (!key || typeof key !== 'string') {
                throw new Error('must provide storage entry key of type string to touch associated data');
            }

            var ssKey = _wrapKey(key);
            if (!item) {
                try {
                    item = JSON.parse(options.useSession ? sessionStorage.getItem(ssKey) : localStorage.getItem(ssKey));
                }
                catch (exception) {
                    // ignore exception
                }
            }

            if (item && item.days) {
                update(key, item.data, _extend(options, { expiry: item.days, item: item }));
            }
        },

        /**
         * Method to extract attributes from a resource key
         *
         * @param key       - resource key
         * @param options   - options object
         * @return {string} - parent key to resource
         * @private
         */
        _extractAttrs = function (key, options) {
            var attrs = key.split(options.attrAccessor);
            if (attrs.length > 1) {
                var _key = attrs[0];
                options.attributes = attrs.splice(1);
                return _key;
            }

            return null;
        } ,

        /**
         * Method to build url with query params
         *
         * @param options   - options object
         * @return {string} - full url with query params
         * @private
         */
        _getUrl = function (options) {
            var url = options.url;
            if (options.method === _get) {
                if (options.params) {
                    for (var key in options.params) {
                        if (options.params.hasOwnProperty(key)) {
                            url += (url.indexOf('?') !== -1 ? '&' : '?') +key+'='+options.params[key];
                        }
                    }
                }
            }

            return url;
        },

        /**
         * Method used to extract relevant data from server response
         *
         * @param options   - options object
         * @param response  - server response
         * @return {object} - extracted data object
         * @private
         */
        _transformResponse = function (options, response) {
            var transform = response;
            if (options.useTransform) {
                transform = options.transform(response);
            }
            else {
                if (options.isJson && options.extract) {
                    var result = {};
                    var attributes = options.extract.split(',');
                    for (var i = 0; i < attributes.length; i++) {
                        var attributes = attributes[i].split(options.attrAccessor);
                        var data = response;
                        var attr = '';
                        for (var j = 0; j < attributes.length; j++) {
                            attr = attributes[j];
                            if (data) {
                                data = data[attr];
                            }
                        }

                        if (data && attr) {
                            result[attr] = data;
                        }
                    }

                    transform = result;
                }
            }

            // attempt to store resource hash
            if (transform && options.hashProp && transform[options.hashProp]) {
                options.params[options.hashProp] = transform[options.hashProp];
            }

            return transform;
        },

        /**
         * Method to make ajax request and sends response back through call back
         *
         * @param key     - resource key
         * @param options - options object
         * @private
         */
        _request = function (key, options) {
            if (!key || typeof key !== 'string') {
                throw new Error('must provide a key of type string');
            }

            options = options || {};
            if (!options.ready) {
                _setDefaultOptions(options);
            }

            options.method = options.method.toUpperCase();

            if (!options.url || typeof options.url !== 'string') {
                throw new Error('must provide a url to fetch data with');
            }

            try {
                var url = _getUrl(options),
                    xhr = new XMLHttpRequest();

                options.isJson = url.indexOf('.json') !== -1;
                xhr.onreadystatechange = function () {
                    if (this.readyState === 4) { // If the HTTP request has completed
                        if (this.status === 200 || this.status === options.unmodStatus) {  // if HTTP status response code is successful (200) or resource is unmodified (304)

                            var returndata;
                            // if cache item is still valid just return cachedItem in call back
                            if (this.status === options.unmodStatus) {
                                returndata = options.cachedItem;
                            }
                            else {
                                //if (options.method == 'POST') { //} || options.method == 'PUT') {
                                // looks like the store isn't valid anymore update store and return server response in call back
                                var response = options.isJson ? JSON.parse(this.response) : this.response;
                                returndata = _transformResponse(options, response);
                                update(key, returndata, options);
                                //}
                            }

                            if (options.method === _delete) {
                                // also remove item from store
                                remove(key);
                                unregisterReq(key);
                            }
                            else {
                                // update item request data
                                registerReq(key, options);
                            }

                            return options.callBack(returndata);
                        }

                        // return server response in case of failure
                        options.callBack(response);
                    }
                };

                var data = null;
                xhr.open(options.method, url, true);
                if (options.method === _post || options.method === _put) {
                    if (options.data) {
                        data = options.isJson ? JSON.stringify(options.data) : options.data;
                        if (options.isJson) {
                            xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
                        }
                    }
                }

                // set custom headers
                for (var header in options.headers) {
                    if (options.headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header, options.headers[header]);
                    }
                }
                xhr.send(data);
            }
            catch(exception) {
                // pass on exception?
                if (options.callBack) {
                    options.callBack(exception);
                }
            }
        },



    /**
     *    PUBLIC METHODS
     */

        /**
         * Method to configure default values for simple store
         * and init store state
         *
         * @param options   - options object
         */
        init = function(options) {
            options = options || {};

            // configure store variables
            for (var key in options) {
                if (_options.hasOwnProperty(key)) {
                    var setValue = options[key];
                    if (setValue !== _undefined) {
                        // just make sure options has proper value type
                        // if not just fail to avoid surprises
                        var defaultValue = _options[key];
                        if (typeof setValue !== typeof defaultValue) {
                            throw new Error('Init(): value for ' + key + ' must be of type: '+typeof defaultValue);
                        }

                        _options[key] = setValue;
                    }
                }
            }

            // init store state
            if (_options.autoClean) {
                if (options.version) {
                    _updateAppVersion(options.version);
                }
                clean();
            }
        },

        /**
         * Used to turn caching on/off
         *
         * @param disable - boolean value
         */
        disable = function (disable) {
            _cachingDisabled = disable;
        },

        /**
         * Used to clear all the data stored using simple store
         * Ignores session storage
         */
        clear = function() {
            var keys = _getKeys();
            for (var i = 0; i < keys.length; i++) {
                localStorage.removeItem(keys[i]);
            }
        },

        /**
         * Used to save an item to web storage
         *
         * @param key       - key to save item in store with
         * @param value     - item to store or update
         * @param [options] - options object
         *
         * @return {boolean}
         */
        save = function(key, value, options) {
            var item;

            // if caching is disabled ignore save
            if (_cachingDisabled) {
                return false;
            }

            if (!key || typeof key !== 'string') {
                throw new Error('Save(): must define key of type string');
            }

            options = options || {};
            if (!options.ready) {
                _setDefaultOptions(options);
            }

            if (!options.operation) {
                options.operation = _save;
            }

            // check if looking for nested data, extract parent item key and attribute names
            if (options.overwrite && !options.attributes && key.indexOf(options.attrAccessor) !== -1 && options.operation === _save) {
                var _key = _extractAttrs(key, options);
                if (_key) {
                    return save(_key, value, options);
                }
            }

            try {

                if (options.operation === _get) {
                    // touching item after get operation
                    item = options.item;
                }
                else {
                    item = get(key, options);
                }

                if (!options.overwrite && item !== _undefined) {
                    throw new Error('Save(): store already contains item with key: ' + key + ', use update() to update item or set overwrite flag to true');
                }

                if (options.overwrite && options.attributes && options.operation === _save && item) {
                    // if save operation is for a nested attribute, update attribute value
                    var _item  = item.data;
                    for (var i = 0; i < options.attributes.length; i++) {
                        var attr = _trim(options.attributes[i]);
                        if (i === options.attributes.length - 1 && _item && attr) {
                            _item[attr] = value;
                        }
                        else if (attr && _item && _item.hasOwnProperty(attr)) {
                            _item = _item[attr];
                        }
                    }

                    // if no item attribute isn't found then this will have no effect
                    value = item.data;
                }

                var _data = {
                    data: value
                };

                // if its an update to existing item carry over item's expiry duration
                if (options.overwrite) {
                    options.expiry = item !== _undefined ? item.days : options.expiry;
                }

                if (options.autoExpiry && !options.noExpiry) {
                    var expiry = new Date().getTime() + (options.expiry * _daysInMillisecs);
                    _extend(_data, {
                        exp: expiry,
                        days: options.expiry
                    });
                }

                var serialized = JSON.stringify(_data);
                var ssKey = _wrapKey(key);
                if (options.useSession) {
                    sessionStorage.setItem(ssKey, serialized);
                } else {
                    localStorage.setItem(ssKey, serialized);
                }

                return true;
            } catch (exception) {
                console.error(exception);
                return false;
            }
        },

        /**
         * Updates an item in the store
         *
         * @param key       - key of item to update in store
         * @param value     - value of item to update in store
         * @param [options] - options object
         *
         * @return {boolean}
         */
        update = function(key, value, options) {
            options = options || {};
            return save(key, value, _extend(options, { overwrite: true }));
        },

        /**
         * Gets an item in the store
         *
         * @param key       - key to retrieve resource with
         * @param [options] - options object
         * @return {object} - stored item if found, otherwise undefined
         */
        get = function(key, options) {
            // if caching is disabled fake cache miss
            if (_cachingDisabled) {
                return _undefined;
            }

            options = options || {};
            if (!options.ready) {
                _setDefaultOptions(options);
            }

            if (!options.operation) {
                options.operation = _get;
            }

            var item = null;

            if (!key || typeof key !== 'string') {
                throw new Error('Get(): must provide storage entry key of type string to retrieve associated data');
            }

            // check if looking for nested data, extract parent item key and attribute names
            if (!options.attributes && key.indexOf(options.attrAccessor) !== -1 && options.operation === _get) {
                var _key = _extractAttrs(key, options);
                if (_key) {
                    return get(_key, options);
                }
            }

            var ssKey = _wrapKey(key);
            try {
                item = JSON.parse(options.useSession ? sessionStorage.getItem(ssKey) : localStorage.getItem(ssKey));
            }
            catch (exception) {
                // ignore exception
            }

            if (item) {
                // check item expiry - destroy if item is expired
                var now = new Date().getTime();
                if (item.exp && item.exp <= now) {
                    item = null;
                    options.useSession ? sessionStorage.removeItem(ssKey) : localStorage.removeItem(ssKey);
                }

                // touch item after cache hit except during updates and for hits for permanent items
                if (options.operation === _get && item && item.exp) {
                    _touch(key, options, item);
                }
            }

            if (options.operation === _save) {
                // if executing a save operation return item with meta data
                return item !== null ? item : _undefined;
            }

            if (options.attributes && options.operation === _get) {
                // if get operation is for a nested attribute, extract attribute value
                for (var i = 0; i < options.attributes.length; i++) {
                    var attr = _trim(options.attributes[i]);
                    if (attr && item) {
                        item = i === 0 ? item.data[attr] : item[attr];
                    }
                }

                return item !== null ? item : _undefined;
            }

            // return saved data
            return item !== null ? item.data : _undefined;
        },

        /**
         * Removes an item from store
         *
         * @param key       - key of item in store to remove
         * @param [options] - options object
         */
        remove = function(key, options) {
            options = options || {};

            if (!key || typeof key !== 'string') {
                throw new Error('Remove(): must provide storage entry key of type string to remove associated data');
            }

            var ssKey = _wrapKey(key);
            if (options.useSession) {
                sessionStorage.removeItem(ssKey);
            } else {
                localStorage.removeItem(ssKey);
            }
        },

        /**
         * Used to clean up storage of expired items
         */
        clean = function() {
            var item,
                now        = new Date().getTime(),
                nextRun    = now + (_options.cleanInterval * _daysInMillisecs),
                cleanupKey = 'cleanUpTime',
                runTime    = get(cleanupKey);

            // check time to see if its due a clean up
            if (!runTime || (runTime <= now)) {
                var keys = _getKeys();
                for (var i = 0; i < keys.length; i++) {
                    item = localStorage.getItem(keys[i]);
                    try {
                        item = JSON.parse(item);
                        if (item.exp && item.exp <= now) {
                            localStorage.removeItem(keys[i]);
                        }
                    }
                    catch (exception) {
                        // just ignore exception
                        // console.error(exception);
                    }
                }

                // update time of next run
                update(cleanupKey, nextRun, { noExpiry: true }); // set no expiry flag since clean up time is permanent
            }
        },

        /**
         * Used to keep store in sync with server
         *
         * @param key       - key of item
         * @param [options] - options object
         */
        fetch = function (key, options) {
            options = options || {};
            _setDefaultOptions(options);

            var cachedRequest = get(_reqPrefix+key);
            if (cachedRequest) {
                if (!options.url) {
                    options.url = cachedRequest.url;
                }

                if (!options.extract) {
                    options.extract = cachedRequest.extract;
                }

                if (_isEmpty(options.params)) {
                    options.params = cachedRequest.params;
                }
            }

            if (!options.url || typeof options.url !== 'string') {
                throw new Error('Fetch(): must provide a url to fetch data with');
            }

            // if cached version exists send its hash with request for server validation
            var cachedItem = get(key, { skipTouch: true });
            if (cachedItem) {
                var itemHash;
                options.cachedItem = cachedItem;
                if (!options.params[options.hashProp]) {
                    if (options.useHashFunc) {
                        itemHash = options.hashResolver(options.cachedItem);
                    }
                    else {
                        if (options.extract && options.extract.indexOf(',') === -1 && options.extract.indexOf(options.attrAccessor) === -1) {  // if data extracted from multiple fields or nested resource a hash function would work better in retriving hash
                            var item = options.cachedItem[options.extract];
                            if (item) {
                                itemHash = item[options.hashProp]
                            }
                        }
                    }

                    if (itemHash) {
                        options.params[options.hashProp] = itemHash;
                    }
                }
            }

            _request(key, options);
        },

        /**
         * Method used to send 'post, put, delete' request and update cache accordingly
         *
         * @param key       - resource key
         * @param [options] - options object
         */
        send = function (key, options) {
            options = options || {};

            if (!options.method) {
                options.method = _post;
            }

            _request(key, options);
        },

        /**
         * Method used to register the request and params for a resource for easy fetching of resource
         *
         * @param key       - resource key
         * @param [options] - options object
         */
        registerReq = function (key, options) {
            options = options || {};
            options.noExpiry = true; // keep urls permanently

            if (!options.url || typeof options.url !== 'string') {
                throw new Error('RegisterReq(): must provide a url to fetch data with');
            }

            var reqParams = {
                url: options.url
            };

            if (options.extract && options.saveParams) {
                _extend(reqParams, { extract: options.extract });
            }

            if (options.params && options.saveParams) {
                _extend(reqParams, { params: options.params });
            }

            update(_reqPrefix+key, reqParams, options);
        },

        /**
         * Method used to un-register the request and params for resource
         *
         * @param key - resource key
         */
        unregisterReq = function (key) {
            remove(_reqPrefix+key);
        };

    // export module
    window.simplestore = {
        init: init,
        clear: clear,
        disable: disable,
        save: save,
        update: update,
        get: get,
        remove: remove,
        clean: clean,
        fetch: fetch,
        send: send,
        registerReq: registerReq,
        unregisterReq: unregisterReq
    };

})();
