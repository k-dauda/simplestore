simplestore
===========

A simple lightweight manager and interface to HTML5 web storage with no dependencies, just plug and play.

Usage
=====
simplestore has no dependencies, just include the script in your project and you are set

___List of options___
* __noExpiry__      - boolean, defaults to false, indicates if a store entry should be stored permanently
* __autoExpiry__    - boolean, defaults to true, indicates if individual store entries should be expired automatically after X number of days see expiry option
* __autoClean__     - boolean, defaults to true, indicates if store should be routinely cleaned after X number of days see cleanInterval option,  clean will remove all expired entries in store
* __derefOperator__ - string, default to dot operator, indicates nested value for a resource
* __useSession__    - boolean, defaults to false, indicates if what type of web storage to use, sessionStorage or localStorage
* __expiry__        - number, defaults to 15 (days), indicates that store entries should be expired after 15 days
* __cleanInterval__ - number, defaults to 30 (days), indicates that store should be cleaned every 30 days to remove expired items
* __unmodStatus__   - number, defaults to 304, server response status code for un-modified data
* __method__        - string, defaults to 'GET', request method for data
* __useHashFunc__   - boolean, defaults to false, indicates whether to use a hash function to evaluate the hash of a resource
* __params__        - object, key value parameters for a resources request
* __extract__       - string, defaults to an empty string, indicates what field to extract data from, from server response
* __hashProp__      - string, defaults to 'hash', for server validation indicates the parameter value to send and receive from the server that uniquely identifies a resource in a request/response
* __saveParams__    - boolean, defaults to true, indicates if parameters for a request should be cached as well
* __useTransform__  - boolean, defaults to false, indicates if a transform method should be used to extract the data from a server response
* __transform__     - function used to transform a server response to a cacheable form
* __hashResolver__  - function used to resolve the hash or unique identifier of a resource
* __callBack__      - function used to return data from ajax requests

Examples
--------
__1. init ([options])__

The init method is used to override the default values in the options list above, clean data for old versions of an app and set up auto-cleaning for a specific intervals.

    // Call init with no options, to use defaults options and set up auto cleaning after the 
    // cleanInterval option's number of days
    simplestore.init();
    // Pass an app version, if you also want stored data to be cleared after a version upgrade.
    simplestore.init({version: 'version1.0.0'});
    // Set default values for any option
    simplestore.init({autoClean: false, noExpiry: true});
    
__2. save (key, value, [options])__

The save method is used to save an item in web storage and defaults to storing items to localStorage. 
If the autoExpiry flag hasn't been turned off, items will be stored for expiry option's number of days.

    // Save item to localStorage
    simplestore.save('library', { name: 'Central Library', location: 'Downtown', numMembers: 800 });
    // Save item to sessionStorage
    simplestore.save('login', { userId: 'pking', passwd: 'somepassword' }, { useSession: true });
    // Save an item permanently
    simplestore.save('dimensions', { height: '100px', width: '200px' }, { noExpiry: true });
      
__3. get (key, [options])__

The get method is used to retrieve an item from web storage, every cache hit will update the items expiry time so it's not cleaned out during 
routine cleaning of localStorage.

    // Get the library object stored above.
    simplestore.get('library');
    // returns login object stored above, note if useSession isn't set to true this will return undefined since 
    // localStorage  will be checked for login object instead of sessionStorage
    simplestore.get('login' { useSession: true });
    // Use derefOperator to get specific attributes of a store object
    simplestore.get('library.location');
    
__4. update (key, [options])__

The update method is to update an item in web storage, will also store items that aren't in storage yet. NB - trying to save an item that already
exists in storage will throw an error.

    // Save an object localStorage (will also overwrite exisiting dimensions object or save a new one)
    simplestore.update('dimensions', { height: '140px', width: '150px' }
    // Update objects in sessionStorage
    simplestore.update('login', { userId: 'pking', passwd: 'newpassword' }, { useSession: true });
    // Update an attribute in an object
    simplestore.update('login.passwd', 'anotherpasswd');
    
__5. remove (key, [options])__

The remove method is used to remove an item from web storage.

    // remove item from localStorage
    simplestore.remove('dimesions');
    // remove item from sessionStorage
    simplestore.remove('login', { useSession: true });
    
__6. disable (boolean)__

The disable method is used to disable caching, called with true, the get method will always return undefined and the save method will
return false without saving the item to web storage.

      simplestore.disable(true);
      
__7. clean__
  
The clean method is used to clean localStorage by removing expired items. If you call the init method with the autoClean
option set to true, ideally you won't need to call this method manually.

    simplestore.clean();
      
__8. clear__

The clear method is used to clear all items in store regardless of whatever or not they are still valid.

    simplestore.clear();
    
__9. fetch(key, [options])__

The fetch method is used to get data from server and cache it, if a callBack function is provided, the data will be returned in the callBack function.
This method can also be used to validate cache by passing a resource hash to the server. If the server returns a 304 status then the value of the resource
is returned from the cache, otherwise a new value is loaded from the server response.

    // The code below will send a request to the server and store the response in localStorage under 
    // the key 'allStudents'
    simplestore.fetch('allStudents', { url: 'allstudents.json', 
        params: { classId: '1001', subjectId: '10005' }, 
        callBack: someCallBack }
    ); 
    // Once the response has been saved, the resource can be retrieved from storage with just its key
    simplestore.get('allStudents');
    // Calling fetch with the same key will make a request to the server with a resource hash, the server 
    // can return a status of 304 to indicate the cached version is still valid or send by the 
    // updated version of the resource which will also be cached
    simplestore.fetch('allStudents');

__10. send (key, [options])__

The send method is used to send updates to server and update cache, defaults to a POST request.

    simplestore.send('some', { url: 'newStudent.json', callBack: function, 
            data: { studentName: 'James', studentId: 10004 },
            method: 'PUT' }
    );

__11. registerReq (key, [options])__

The registerReq method is used to register a request for a resource, this is used in conjuction with the fetch method.

    simplestore.reqisterReq('allStudents', { url: 'allstudents.json', params: { classId: '1001' } });
    simplestore.fetch('allStudents');
    
__12. unregisterReq (key)__

The unregisterReq method is used to unregister a request for a resource.

    simplestore.unregisterReq('allStudents');
   
License
========

Copyright (c) 2013 Kazah Dauda <kazah.a.dauda@gmail.com> (http://github.com/k-dauda/)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: 

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
