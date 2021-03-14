"use strict";

 const axios = require("axios");
 const hash = require("object-hash");
 
 class Http {
   constructor() {
     this.promises = {};
   }
 
   useBaseUrl = (url) => {
     axios.defaults.baseURL = url;
   };
 
   _getPromiseSha = (func, name, ...args) => {
     const sha = hash([name, ...args]);
 
     if (sha in this.promises) {
       if (!this.promises[sha].done) {
         return sha;
       }
     }
 
     this.promises[sha] = func(...args);
     this.promises[sha].done = false;
 
     return sha;
   };
 
   _getPromiseResult = async (sha) => {
     try {
       const result = await this.promises[sha];
       this.promises[sha].done = true;
       return result;
     } catch (err) {
       this.promises[sha].done = true;
       throw err;
     }
   };
 
   get = async (...args) => {
     const sha = this._getPromiseSha(axios.get, "get", ...args);
     return this._getPromiseResult(sha);
   };
 
   post = (...args) => {
     const sha = this._getPromiseSha(axios.post, "post", ...args);
     return this._getPromiseResult(sha);
   };
 
   put = (...args) => {
     const sha = this._getPromiseSha(axios.put, "put", ...args);
     return this._getPromiseResult(sha);
   };
 
   delete = (...args) => {
     const sha = this._getPromiseSha(axios.delete, "delete", ...args);
     return this._getPromiseResult(sha);
   };
 }
 
 export default new Http();
 