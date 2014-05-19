(function() {

  var requestQueue = {};
  var requestSeq = 1;
  var FlashXMLHttpRequest = function() {
    var loadPolicyURL = 
      sforce.connection.serverUrl.split('/').slice(0, 3).join('/')+
      '/services/Soap/u/crossdomain.xml';
    this.flxhr = new flensed.flXHR({ autoUpdatePlayer : true, loadPolicyURL : loadPolicyURL });
    var _this = this;
    this.flxhr.onreadystatechange = function() {
      if (_this.flxhr.readyState==4) {
        delete requestQueue['_'+_this.seqnum];
      }
      if (_this.onreadystatechange) {
        var props = 'readyState,status,statusText,responseText,responseXML'.split(',');
        for (var i=0; i<props.length; i++) {
          _this[props[i]] = _this.flxhr[props[i]];
        }
        _this.onreadystatechange.apply(_this, arguments);
      }
    }
  }

  FlashXMLHttpRequest.prototype = {
    setRequestHeader : function(name, value) {
      // override xmlhttprequest, because sforce client sets user-agent header but flXHR doesn't support it and raises error.
      if (name.toLowerCase()!=='user-agent') {
        this.flxhr.setRequestHeader(name, value);
      }
    },
    open : function(method, url, async) {
      this.flxhr.open.apply(this.flxhr, arguments);
    },
    send : function(data) {
      this.seqnum = requestSeq++;
      requestQueue['_'+this.seqnum] = this;
      this.flxhr.send.apply(this.flxhr, arguments);
    },
    getResponseHeader : function() {
      return null;
    },
    getAllResponseHeader : function() {
      return '';
    }
  }

  setTimeout(function() {
    window.flensed.throwUnhandledError = function(e) {
      alert('throwUnhandledError');
      for (var k in requestQueue) {
        var xhr = requestQueue[k];
        delete requestQueue[k];
        if (xhr.onreadystatechange) {
          xhr.readyState = 4;
          xhr.status = 500;
          xhr.statusText = 'Internal Server Error';
          xhr.responseText = 'Internal Server Error';
          xhr.onreadystatechange();
          delete xhr.onreadystatechange;
        }
      }
      throw new Error(e);
    }
  }, 1000);


  var _Transport = sforce.Transport;
  sforce.Transport = function() {
    _Transport.apply(this, arguments);
    this.newConnection = function() {
      return this.connection = new FlashXMLHttpRequest
    }
  }

  sforce.connection.login = function(username, password, callback) {
    var arg1 = new sforce.internal.Parameter("username", username, false);
    var arg2 = new sforce.internal.Parameter("password", password, false);
    var _this = this;
    callback = typeof callback == 'function' ? {
                 onSuccess : callback,
                 onFailure : callback
               } : callback;
    return this.invoke("login", [arg1, arg2], false, {
      onSuccess : function(result) {
        sforce.connection.sessionId = result.sessionId;
        sforce.connection.serverUrl = result.serverUrl;
        if (callback) callback.onSuccess(result);
      }, 
      onFailure : callback ? callback.onFailure : function(){}
    });
  }

  sforce.connection.serverUrl = 'https://login.salesforce.com' + sforce.connection.serverUrl;

})()
