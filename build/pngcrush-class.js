(function (exports) {

    var noop = function () { };

    function pngcrush() {
        this.callbacks = {
            'error': [],
            'done': [],
            'start': [],
            'stdout': []
        };
    }

    pngcrush.prototype.exec = function (file, notify) {
        var self = this;

        if (this.execPromise) {
            return this.execPromise.catch(noop).then(function () {
                return self.exec(file, notify);
            });
        }

        if (file.type !== 'image/png') {
            return Promise.reject(file);
        }

        var promise = this.execPromise = this.readAsArrayBuffer(file).then(function (event) {
            var arrayBuffer = event.target.result;
            return self.initWorker().then(function (worker) {
                var done = new Promise(function (resolve, reject) {
                    var offDone, offError, offStdout;
                    offDone = self.once('done', function (event) {
                        offError();
                        offStdout();
                        resolve(event);
                    });
                    offError = self.once('error', function (event) {
                        offDone();
                        offStdout();
                        reject(event);
                    });
                    offStdout = self.on('stdout', function (event) {
                        if (typeof notify === 'function') {
                            notify.call(self, event);
                        }
                    });
                    worker.postMessage({
                        'type': 'file',
                        'data': new Uint8Array(arrayBuffer)
                    });
                    worker.postMessage({
                        'type': 'command',
                        'command': 'go'
                    });
                });
                done.catch(noop).then(function () {
                    worker.terminate();
                });
                return done;
            });
        });

        promise.catch(noop).then(function () {
            if (promise === self.execPromise) {
                delete self.execPromise;
            }
        });

        return promise;
    };

    pngcrush.prototype.initWorker = function () {
        var self = this;

        if (this.workerPromise) {
            return this.workerPromise;
        }

        var promise = this.workerPromise = new Promise(function (resolve, reject) {
            var worker = new Worker('js/vendor/pngcrush.worker.js');
            worker.onerror = function (event) {
                var callbacks = [];
                reject(event);
                Array.prototype.push.apply(callbacks, self.callbacks.error);
                while (callbacks.length) {
                    callbacks.shift().call(self, event);
                }
            };
            worker.onmessage = function (event) {
                if (event.data.type === 'ready') {
                    worker.onmessage = function (event) {
                        var name = event.data.type;
                        if (typeof self.callbacks[name] !== 'undefined') {
                            var callbacks = [];
                            Array.prototype.push.apply(callbacks, self.callbacks[name]);
                            while (callbacks.length) {
                                callbacks.shift().call(self, event);
                            }
                        }
                    };
                    resolve(worker);
                }
            };
        });

        promise.catch(noop).then(function () {
            if (promise === self.workerPromise) {
                delete self.workerPromise;
            }
        });

        return promise;
    };

    pngcrush.prototype.on = function (name, callback) {
        var self = this;
        if (typeof this.callbacks[name] !== 'undefined' && typeof callback === 'function') {
            this.callbacks[name].push(callback);
            var off = (function () {
                var ran = false;
                return function () {
                    if (ran === true) {
                        return;
                    }
                    ran = true;
                    var idx = self.callbacks[name].lastIndexOf(callback);
                    if (idx !== -1) {
                        self.callbacks[name].splice(idx - 1, 1);
                    }
                };
            })();
            return off;
        }
        return noop;
    };

    pngcrush.prototype.once = function (name, callback) {
        var off = this.on(name, function () {
            off();
            callback.apply(this, arguments);
        });
        return off;
    };

    pngcrush.prototype.readAsArrayBuffer = function (file) {
        var fileReader = new FileReader();
        return new Promise(function (resolve, reject) {
            fileReader.onerror = reject;
            fileReader.onload = resolve;
            fileReader.readAsArrayBuffer(file);
        });
    };

    pngcrush.prototype.readAsDataURL = function (file) {
        var fileReader = new FileReader();
        return new Promise(function (resolve, reject) {
            fileReader.onerror = reject;
            fileReader.onload = resolve;
            fileReader.readAsDataURL(file);
        });
    };

    exports.pngcrush = pngcrush;

})(this);
