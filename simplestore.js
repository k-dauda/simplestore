/*
 Copyright (c) 2013 kdauda Inc. - Author: Kazah Dauda (http://k-dauda.github.com/)

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

var simplestore =  (function () {

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
        _appKey             = 'appVersion',
        _options            = {
            noExpiry           : false,             // default flag to indicate permanent item that should never expire
            autoExpiry         : true,              // default flag to clean specific store entries after x number of days
            autoClean          : true,              // default flag to clean store after x number of days or after version upgrade
            isSessionItem      : false,             // default flag to indicate type of storage to save item in
            expiry             : 30,                // default expiry of items is 30 days
            itemValidCode      : 304,               // server response indicating that a cached item is still valid
            method             : 'GET',             // default request method
            useHashFunc        : false,             // default flag to indicate the use of the hash function over the hash property
            params             : {},                // default parameters object for requests
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
         * @params options - options object
         * @private
         */
        _setDefaultOptions = function (options) {
            for (var key in _options) {
                if (_options.hasOwnProperty(key)) {
                    if (!options[key]) {
                        options[key] = _options[key];
                    }
                    else {
                        // just make sure options has proper value type
                        var defaultValue = _options[key];
                        if (typeof options[key] !== typeof defaultValue) {
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
         * Method to build url with query params
         *
         * @params options  - options object
         * @return {string} - full url with query params
         * @private
         */
        _getUrl = function (options) {
            var url = options.url;
            if (options.method === 'GET') {
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
                    var fields = options.extract.split(',');
                    for (var i = 0; i < fields.length; i++) {
                        var nestedfields = fields[i].split('.');
                        var data = response;
                        var field = '';
                        for (var j = 0; j < nestedfields.length; j++) {
                            field = nestedfields[j];
                            if (data) {
                                data = data[field];
                            }
                        }

                        if (data) {
                            result[field] = data;
                        }
                    }

                    transform = result;
                }
            }

            return transform;
        },

        /**
         * Used to clean out data that was stored for an old version
         *
         * @param newVersion - new version to store
         * @private
         */
        _clearOldVersionData = function(newVersion) {
            if (!newVersion || typeof newVersion !== 'string') {
                throw new Error('must provide new app version of type string');
            }

            var oldVersion = get(appKey);
            // compare versions and clean if not the same
            if (oldVersion !== newVersion) {
                clear();
            }

            // update app version to latest
            update(appKey, newVersion, { noExpiry: true });
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
                    item = JSON.parse(options.isSessionItem ? sessionStorage.getItem(ssKey) : localStorage.getItem(ssKey));
                }
                catch (exception) {
                    // ignore exception
                }
            }

            if (item && item.days) {
                options.expiry = item.days;
                options.skipGet = true;
                options.item = item;
                update(key, item.data, options);
            }
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
                var url   = _getUrl(options);
                var xhr   = new XMLHttpRequest();
                options.isJson = url.indexOf('.json') !== -1; // TODO watch out for jsonp
                xhr.onreadystatechange = function () {
                    if (this.readyState == 4) { // If the HTTP request has completed
                        if (this.status == 200 || this.status == options.itemValidCode) {  // if HTTP status response code is successful (200) or resource is unmodified (304)

                            var returndata;
                            // if cache item is still valid just return cachedItem in call back
                            if (this.status == options.itemValidCode) {
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

                            // update item request data
                            registerReq(key, options);

//                          if (options.method == 'DELETE') {
//                              // also remove item from store
//                              remove(key);
//                          }
                            return options.callBack(returndata);
                        }

                        // return server response in case of failure
                        options.callBack(response);
                    }
                };

                var data = null;
                xhr.open(options.method, url, true);
                if (options.method === 'POST' || options.method === 'PUT') {
                    if (options.data) {
                        data = options.isJson ? JSON.stringify(options.data) : options.data;
                        if (options.isJson) {
                            xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
                        }
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
         *
         * @param options
         */
        configure = function(options) {
            options = options || {};

            for (var key in options) {
                if (_options.hasOwnProperty(key)) {
                    if (options[key]) {
                        // just make sure options has proper value type
                        // if not just fail to avoid surprises
                        if (typeof options[key] !== typeof _options[key]) {
                            throw new Error('value for ' + key + ' must be of type: '+type);
                        }

                        _options[key] = options[key];
                    }
                }
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

            options = options || {};
            if (!options.ready) {
                _setDefaultOptions(options);
            }

            try {
                if (!key || typeof key !== 'string') {
                    throw new Error('must define key of type string');
                }

                if (options.skipGet) {
                    item = options.item;
                }
                else {
                    options.skipTouch = true; // transient flag used to prevent touch during get below
                    item = get(key, options);
                }

                if (!options.overwrite && item !== void 0) {
                    throw new Error('store already contains item with key: ' + key + ', use update() to update item or set overwrite flag to true');
                }

                var _data = {
                    data: value
                };

                // if its an update to existing item carry over item's expiry duration
                if (options.overwrite) {
                    options.expiry = item !== void 0 ? item.days : options.expiry;
                }

                if (options.autoExpiry && !options.noExpiry && options.expiry) {
                    var expiry = new Date().getTime() + (options.expiry * _daysInMillisecs);
                    _extend(_data, {
                        exp: expiry,
                        days: options.expiry
                    });
                }

                var serialized = JSON.stringify(_data);
                var ssKey = _wrapKey(key);
                if (options.isSessionItem) {
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
            options.overwrite = true;
            return save(key, value, options);
        },

        /**
         * Gets an item in the store
         *
         * @param key       - key to retrieve resource with
         * @param [options] - options object
         * @return {object} - stored item if found, otherwise undefined
         */
        get = function(key, options) {
            var item = null;

            options = options || {};

            // if caching is disabled fake cache miss
            if (_cachingDisabled) {
                return void 0;
            }

            if (!key || typeof key !== 'string') {
                throw new Error('must provide storage entry key of type string to retrieve associated data');
            }

            var ssKey = _wrapKey(key);
            try {
                item = JSON.parse(options.isSessionItem ? sessionStorage.getItem(ssKey) : localStorage.getItem(ssKey));
            }
            catch (exception) {
                // ignore exception
            }

            if (item) {
                // check item expiry - destroy if item is expired
                var now = new Date().getTime();
                if (item.exp && item.exp <= now) {
                    item = null;
                    options.isSessionItem ? sessionStorage.removeItem(ssKey) : localStorage.removeItem(ssKey);
                }

                // touch item after cache hit except during updates and for hits for permanent items
                if (!options.skipTouch && item && item.exp) {
                    _touch(key, options, item);
                }
            }

            return item !== null ? item.data : void 0;
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
                throw new Error('must provide storage entry key of type string to remove associated data');
            }

            var ssKey = _wrapKey(key);
            if (options.isSessionItem) {
                sessionStorage.removeItem(ssKey);
            } else {
                localStorage.removeItem(ssKey);
            }
        },

        /**
         * Used to clean up storage of expired items
         */
        clean = function() {
            var item, nextRun, now, runTime, cleanupKey;

//          if (!_options.autoClean) {
//              return;
//          }

            now        = new Date().getTime();
            nextRun    = now + (_options.expiry * _daysInMillisecs);
            cleanupKey = 'cleanUpTime';
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
         * Used to update an apps version
         * if auto clean is set, clean old app data
         *
         * @param version - version to store
         */
        updateAppVersion = function (version) {
            if (_options.autoClean) {
                _clearOldVersionData(version);
            }
            else {
                update(_appKey, version, { noExpiry: true });
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
                throw new Error('must provide a url to fetch data with');
            }

            // if cached version exists send its hash with request for server validation
            var cachedItem = get(key, { skipTouch: true });
            if (cachedItem) {
                var itemHash;
                options.cachedItem = cachedItem;
                if (options.useHashFunc) {
                    itemHash = options.hashResolver(options.cachedItem);
                }
                else {
                    if (options.extract && options.extract.indexOf(',') === -1 && options.extract.indexOf('.') === -1) {  // if data extracted from multiple fields or nested resource a hash function would work better in retriving hash
                        var item = options.cachedItem[options.extract];
                        if (item) {
                            itemHash = item[options.hashProp]
                        }
                    }
                    else {
                        if (options.hashProp) {
                            itemHash = options.cachedItem[options.hashProp];
                        }
                    }
                }

                if (itemHash) {
                    options.params[options.hashProp] = itemHash;
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
                options.method = 'POST';
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
                throw new Error('must provide a url to fetch data with');
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
            // remove(key); remove stored data as well?
            remove(_reqPrefix+key);
        },

        /**
         * Method used to register a list of requests and params for resources for easy fetching of resources
         *
         * @param reqs - list of request objects
         */
        registerAllReqs = function (reqs) {
            if (reqs && typeof reqs.push === 'function') {
                for (var i = 0; i < reqs.length; i++) {
                    registerReq(req[i].key, req[i].options);
                }
            }
        },

        /**
         * Method used to un-register list of requests and params for resources
         *
         * @param keys - resource keys
         */
        unregisterAllReqs = function (keys) {
            if (keys && typeof keys.push === 'function') {
                for (var i = 0; i < keys.length; i++) {
                    unregisterReq(keys[i]);
                }
            }
        };

    return {
        configure: configure,
        clear: clear,
        disable: disable,
        save: save,
        update: update,
        get: get,
        remove: remove,
        clean: clean,
        updateAppVersion: updateAppVersion,
        fetch: fetch,
        send: send,
        registerReq: registerReq,
        unregisterReq: unregisterReq,
        registerAllReqs: registerAllReqs,
        unregisterAllReqs: unregisterAllReqs
    };

})();