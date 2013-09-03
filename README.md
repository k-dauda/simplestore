simplestore
===========

A simple lightweight manager and interface to HTML5 web storage with no dependencies, just plug and play.

Usage
=====
simplestore has no dependencies, just include the script in your project and you are set

__List of options__
* noExpiry      - boolean, defaults to false, indicates if a store entry should be stored permanently
* autoExpiry    - boolean, defaults to true, indicates if individual store entries should be expired automatically after X number of days see expiry option
* autoClean     - boolean, defaults to true, indicates if store should be routinely cleaned after X number of days see cleanInterval option,  clean will remove all expired entries in store
* useSession    - boolean, defaults to false, indicates if what type of web storage to use, sessionStorage or localStorage
* expiry        - number, defaults to 15 (days), indicates that store entries should be expired after 15 days
* cleanInterval - number, defaults to 30 (days), indicates that store should be cleaned every 30 days to remove expired items
* unmodStatus   - number, defaults to 304, server response status code for un-modified data
* method        - string, defaults to 'GET', request method for data
* useHashFunc   - boolean, defaults to false, indicates whether to use a hash function to evaluate the hash of a resource
* params        - object, key value parameters for a resources request
* extract       - string, defaults to an empty string, indicates what field to extract data from, from server response
* hashProp      - string, defaults to 'hash', for server validation indicates the parameter value to send and receive from the server that uniquely identifies a resource in a request/response
* saveParams    - boolean, defaults to true, indicates if parameters for a request should be cached as well
* useTransform  - boolean, defaults to false, indicates if a transform method should be used to extract the data from a server response
* transform     - function used to transform a server response to a cacheable form
* hashResolver  - function used to resolve the hash or unique identifier of a resource
* callBack      - function used to return data from ajax requests

__Examples__
* init ([options])
   The init method is used to override the default values in the options list, clean data for old versions of an app and set up auto-cleaning for a specific intervals. 
      1. simplestore.init(); // if you are happy with the default options and just want to set up auto cleaning 
      2. simplestore.init({ version: 'version1.0.0' }); // if you want to add a version number for your application, once this version changes, it will clear the store to protect against old version data formats
      3. simplestore.init({ noExpiry: true }); // if you want all items to be stored permanently
* save (key, value, [options])
   Used to save an item in web storage.
      1. simplestore.save('library', { name: 'Central Library', location: 'Downtown', numMembers: 800 });
      2. simplestore.save('login', { userId: 'pking', passed: 'somepassword' }, { useSession: true }); // save a value to session
      3. simplestore.save('dimensions', { height: '100px', width: '200px' }, { noExpiry: true }); // save entry permanently
* get (key, [options])
   Used to retrieve an item from web storage
      1. simplestore.get('library'); // returns library object above
      2. simplestore.get('login' { useSession: true }); // returns login object above, note if useSession isn't set to true this will return undefined since localStorage will be checked instead of sessionStorage
* update (key, [options])
   Used to update an item in web storage
      1. simplestore.update('dimensions', { height: '140px', width: '150px' }
* remove (key, [options])
   Used to remove an item from web storage
      1. simplestore.remove('dimesions');
* disable (boolean)
   Used to disable caching 
      1. simplestore.disable(true);
* clean
   Used to clean localStorage - ie remove expired items
      1. simplestore.clean();
* clear ()
   Used to clear all items in store
      1. simplestore.clear();
* fetch(key, [options])
   Used to get data from server and cache it, can also be used to validate cache
      1. simplestore.fetch('allStudents', { url: 'allstudents.json', params: { classId: '1001', subjectId: '10005' }, callBack: function }); 
      // This will create request url: allstudents.json?classId=1001&subjectId=10005 and will send the response back using the callBack function
      // the response and the request parameters will also be cached so you can now do the following below.
      2. simplestore.get('allStudents'); // this will return stored version of data
      3. simplestore.fetch('allStudents'); // this will make another request and either return the stored version if the server returns a status of 304 or it will return the server response and update the cache
* send (key, [options]);
   Used to send update to server and update cache POST/PUT/DELETE
      1. simplestore.send('some', { url: 'newStudent.json', callBack: function, data: { studentName: 'James', studentId: 10004 }, method: 'PUT' }); // This will update the store and set the data to the server
* registerReq (key, [options])
   Used to register a request for a resource, this is used in conjuction with the fetch method.
      1. simplestore.reqisterReq('allStudents', { url: 'allstudents.json', params: { classId: '1001' } });
* unregisterReq (key)
   Used to unregister a request for a resource
      1. simplestore.unregisterReq('allStudents');
   
License
========

Copyright (c) 2013 Kazah Dauda <kazah.a.dauda@gmail.com> (http://k-dauda.github.com/)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: 

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
