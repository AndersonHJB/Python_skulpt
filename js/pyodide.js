!function (global, factory) {
    "object" == typeof exports && "undefined" != typeof module ? factory(exports) : "function" == typeof define && define.amd ? define(["exports"], factory) : factory((global = "undefined" != typeof globalThis ? globalThis : global || self).loadPyodide = {})
}(this, (function (exports) {
    "use strict";
    let Module = {};

    function setStandardStreams(stdin, stdout, stderr) {
        stdout && (Module.print = stdout), stderr && (Module.printErr = stderr), stdin && (Module.preRun = [function () {
            Module.FS.init(function (stdin) {
                const encoder = new TextEncoder;
                let input = new Uint8Array(0), inputIndex = -1;

                function stdinWrapper() {
                    try {
                        if (-1 === inputIndex) {
                            let text = stdin();
                            if (null == text) return null;
                            if ("string" != typeof text) throw new TypeError(`Expected stdin to return string, null, or undefined, got type ${typeof text}.`);
                            text.endsWith("\n") || (text += "\n"), input = encoder.encode(text), inputIndex = 0
                        }
                        if (inputIndex < input.length) {
                            let character = input[inputIndex];
                            return inputIndex++, character
                        }
                        return inputIndex = -1, null
                    } catch (e) {
                        throw console.error("Error thrown in stdin:"), console.error(e), e
                    }
                }

                return stdinWrapper
            }(stdin), null, null)
        }])
    }

    Module.noImageDecoding = !0, Module.noAudioDecoding = !0, Module.noWasmDecoding = !1, Module.preloadedWasm = {};
    const IN_NODE = "undefined" != typeof process && "undefined" !== process.release.name;
    let baseURL;

    async function initializePackageIndex(indexURL) {
        let package_json;
        if (baseURL = indexURL, IN_NODE) {
            const fsPromises = await import("fs/promises"),
                package_string = await fsPromises.readFile(`${indexURL}packages.json`);
            package_json = JSON.parse(package_string)
        } else {
            let response = await fetch(`${indexURL}packages.json`);
            package_json = await response.json()
        }
        if (!package_json.packages) throw new Error("Loaded packages.json does not contain the expected key 'packages'.");
        Module.packages = package_json.packages, Module._import_name_to_package_name = new Map;
        for (let name of Object.keys(Module.packages)) for (let import_name of Module.packages[name].imports) Module._import_name_to_package_name.set(import_name, name)
    }

    const package_uri_regexp = /^.*?([^\/]*)\.js$/;

    function _uri_to_package_name(package_uri) {
        let match = package_uri_regexp.exec(package_uri);
        if (match) return match[1].toLowerCase()
    }

    let loadScript;
    if (globalThis.document) loadScript = url => import(url); else if (globalThis.importScripts) loadScript = async url => {
        globalThis.importScripts(url)
    }; else {
        if ("undefined" == typeof process || "node" !== process.release.name) throw new Error("Cannot determine runtime environment");
        {
            const pathPromise = import("path").then((M => M.default)),
                fetchPromise = import("node-fetch").then((M => M.default)),
                vmPromise = import("vm").then((M => M.default));
            loadScript = async url => {
                if (url.includes("://")) {
                    const fetch = await fetchPromise;
                    (await vmPromise).runInThisContext(await (await fetch(url)).text())
                } else {
                    const path = await pathPromise;
                    await import(path.resolve(url))
                }
            }
        }
    }

    function recursiveDependencies(names, _messageCallback, errorCallback, sharedLibsOnly) {
        const toLoad = new Map, addPackage = name => {
            if (name = name.toLowerCase(), !toLoad.has(name) && (toLoad.set(name, "default channel"), void 0 === loadedPackages[name])) for (let dep_name of Module.packages[name].depends) addPackage(dep_name)
        };
        for (let name of names) {
            const pkgname = _uri_to_package_name(name);
            toLoad.has(pkgname) && toLoad.get(pkgname) !== name ? errorCallback(`Loading same package ${pkgname} from ${name} and ${toLoad.get(pkgname)}`) : void 0 === pkgname ? (name = name.toLowerCase(), name in Module.packages ? addPackage(name) : errorCallback(`Skipping unknown package '${name}'`)) : toLoad.set(pkgname, name)
        }
        if (sharedLibsOnly) {
            let onlySharedLibs = new Map;
            for (let c of toLoad) {
                let name = c[0];
                Module.packages[name].shared_library && onlySharedLibs.set(name, toLoad.get(name))
            }
            return onlySharedLibs
        }
        return toLoad
    }

    async function _loadPackage(names, messageCallback, errorCallback) {
        let toLoad = recursiveDependencies(names, 0, errorCallback);
        if (Module.locateFile = path => {
            let pkg = path.replace(/\.data$/, "");
            if (toLoad.has(pkg)) {
                let package_uri = toLoad.get(pkg);
                if ("default channel" != package_uri) return package_uri.replace(/\.js$/, ".data")
            }
            return baseURL + path
        }, 0 === toLoad.size) return Promise.resolve("No new packages to load");
        messageCallback(`Loading ${Array.from(toLoad.keys()).join(", ")}`);
        let scriptPromises = [];
        for (let [pkg, uri] of toLoad) {
            let loaded = loadedPackages[pkg];
            if (void 0 !== loaded) {
                if (loaded === uri || "default channel" === uri) {
                    messageCallback(`${pkg} already loaded from ${loaded}`);
                    continue
                }
                errorCallback(`URI mismatch, attempting to load package ${pkg} from ${uri} while it is already loaded from ${loaded}. To override a dependency, load the custom package first.`);
                continue
            }
            let pkgname = Module.packages[pkg] && Module.packages[pkg].name || pkg,
                scriptSrc = "default channel" === uri ? `${baseURL}${pkgname}.js` : uri;
            messageCallback(`Loading ${pkg} from ${scriptSrc}`), scriptPromises.push(loadScript(scriptSrc).catch((e => {
                errorCallback(`Couldn't load package from URL ${scriptSrc}`, e), toLoad.delete(pkg)
            })))
        }
        try {
            await Promise.all(scriptPromises).then((function () {
                const promise = new Promise((r => {
                    Module.monitorRunDependencies = n => {
                        0 === n && r()
                    }
                }));
                return Module.addRunDependency("dummy"), Module.removeRunDependency("dummy"), promise
            }))
        } finally {
            delete Module.monitorRunDependencies
        }
        let resolveMsg, packageList = [];
        for (let [pkg, uri] of toLoad) loadedPackages[pkg] = uri, packageList.push(pkg);
        if (packageList.length > 0) {
            resolveMsg = `Loaded ${packageList.join(", ")}`
        } else resolveMsg = "No packages loaded";
        Module.reportUndefinedSymbols(), messageCallback(resolveMsg), Module.runPythonSimple("import importlib\nimportlib.invalidate_caches()\n")
    }

    let _package_lock = Promise.resolve();
    let loadedPackages = {};

    async function loadPackage(names, messageCallback, errorCallback) {
        if (Module.isPyProxy(names)) {
            let temp;
            try {
                temp = names.toJs()
            } finally {
                names.destroy()
            }
            names = temp
        }
        Array.isArray(names) || (names = [names]);
        let oldPlugin, sharedLibraryNames = [];
        try {
            let sharedLibraryPackagesToLoad = recursiveDependencies(names, 0, errorCallback, !0);
            for (let pkg of sharedLibraryPackagesToLoad) sharedLibraryNames.push(pkg[0])
        } catch (e) {
        }
        for (let p in Module.preloadPlugins) if (Module.preloadPlugins[p].canHandle("test.so")) {
            oldPlugin = Module.preloadPlugins[p];
            break
        }
        var loadPluginOverride = new Proxy(oldPlugin, {
            get: function (obj, prop) {
                return "handle" === prop ? function (bytes, name) {
                    obj[prop].apply(obj, arguments), this.asyncWasmLoadPromise = this.asyncWasmLoadPromise.then((function () {
                        Module.loadDynamicLibrary(name, {global: !0, nodelete: !0})
                    }))
                } : obj[prop]
            }
        });
        Module.preloadPlugins.unshift(loadPluginOverride);
        let releaseLock = await async function () {
            let releaseLock, old_lock = _package_lock;
            return _package_lock = new Promise((resolve => releaseLock = resolve)), await old_lock, releaseLock
        }();
        try {
            await _loadPackage(sharedLibraryNames, messageCallback || console.log, errorCallback || console.error), Module.preloadPlugins.shift(loadPluginOverride), await _loadPackage(names, messageCallback || console.log, errorCallback || console.error)
        } finally {
            releaseLock()
        }
    }

    function isPyProxy(jsobj) {
        return !!jsobj && void 0 !== jsobj.$$ && "PyProxy" === jsobj.$$.type
    }

    Module.isPyProxy = isPyProxy, globalThis.FinalizationRegistry ? Module.finalizationRegistry = new FinalizationRegistry((([ptr, cache]) => {
        pyproxy_decref_cache(cache);
        try {
            Module._Py_DecRef(ptr)
        } catch (e) {
            Module.fatal_error(e)
        }
    })) : Module.finalizationRegistry = {
        register() {
        }, unregister() {
        }
    };
    let trace_pyproxy_alloc, trace_pyproxy_dealloc, pyproxy_alloc_map = new Map;

    function _getPtr(jsobj) {
        let ptr = jsobj.$$.ptr;
        if (null === ptr) throw new Error(jsobj.$$.destroyed_msg || "Object has already been destroyed");
        return ptr
    }

    Module.pyproxy_alloc_map = pyproxy_alloc_map, Module.enable_pyproxy_allocation_tracing = function () {
        trace_pyproxy_alloc = function (proxy) {
            pyproxy_alloc_map.set(proxy, Error().stack)
        }, trace_pyproxy_dealloc = function (proxy) {
            pyproxy_alloc_map.delete(proxy)
        }
    }, Module.disable_pyproxy_allocation_tracing = function () {
        trace_pyproxy_alloc = function (proxy) {
        }, trace_pyproxy_dealloc = function (proxy) {
        }
    }, Module.disable_pyproxy_allocation_tracing(), Module.pyproxy_new = function (ptrobj, cache) {
        let target, flags = Module._pyproxy_getflags(ptrobj), cls = Module.getPyProxyClass(flags);
        if (256 & flags ? (target = Reflect.construct(Function, [], cls), delete target.length, delete target.name, target.prototype = void 0) : target = Object.create(cls.prototype), !cache) {
            cache = {cacheId: Module.hiwire.new_value(new Map), refcnt: 0}
        }
        cache.refcnt++, Object.defineProperty(target, "$$", {
            value: {
                ptr: ptrobj,
                type: "PyProxy",
                borrowed: !1,
                cache: cache
            }
        }), Module._Py_IncRef(ptrobj);
        let proxy = new Proxy(target, PyProxyHandlers);
        return trace_pyproxy_alloc(proxy), Module.finalizationRegistry.register(proxy, [ptrobj, cache], proxy), proxy
    };
    let pyproxyClassMap = new Map;
    Module.getPyProxyClass = function (flags) {
        let result = pyproxyClassMap.get(flags);
        if (result) return result;
        let descriptors = {};
        for (let [feature_flag, methods] of [[1, PyProxyLengthMethods], [2, PyProxyGetItemMethods], [4, PyProxySetItemMethods], [8, PyProxyContainsMethods], [16, PyProxyIterableMethods], [32, PyProxyIteratorMethods], [64, PyProxyAwaitableMethods], [128, PyProxyBufferMethods], [256, PyProxyCallableMethods]]) flags & feature_flag && Object.assign(descriptors, Object.getOwnPropertyDescriptors(methods.prototype));
        descriptors.constructor = Object.getOwnPropertyDescriptor(PyProxyClass.prototype, "constructor"), Object.assign(descriptors, Object.getOwnPropertyDescriptors({$$flags: flags}));
        let new_proto = Object.create(PyProxyClass.prototype, descriptors);

        function NewPyProxyClass() {
        }

        return NewPyProxyClass.prototype = new_proto, pyproxyClassMap.set(flags, NewPyProxyClass), NewPyProxyClass
    }, Module.PyProxy_getPtr = _getPtr, Module.pyproxy_mark_borrowed = function (proxy) {
        proxy.$$.borrowed = !0
    };

    function pyproxy_decref_cache(cache) {
        if (cache && (cache.refcnt--, 0 === cache.refcnt)) {
            let cache_map = Module.hiwire.pop_value(cache.cacheId);
            for (let proxy_id of cache_map.values()) Module.pyproxy_destroy(Module.hiwire.pop_value(proxy_id), "This borrowed attribute proxy was automatically destroyed in the process of destroying the proxy it was borrowed from. Try using the 'copy' method.")
        }
    }

    Module.pyproxy_destroy = function (proxy, destroyed_msg) {
        let ptrobj = _getPtr(proxy);
        Module.finalizationRegistry.unregister(proxy), proxy.$$.ptr = null, proxy.$$.destroyed_msg = destroyed_msg, pyproxy_decref_cache(proxy.$$.cache);
        try {
            Module._Py_DecRef(ptrobj), trace_pyproxy_dealloc(proxy)
        } catch (e) {
            Module.fatal_error(e)
        }
    }, Module.callPyObjectKwargs = function (ptrobj, ...jsargs) {
        let kwargs = jsargs.pop(), num_pos_args = jsargs.length, kwargs_names = Object.keys(kwargs),
            kwargs_values = Object.values(kwargs), num_kwargs = kwargs_names.length;
        jsargs.push(...kwargs_values);
        let idresult, idargs = Module.hiwire.new_value(jsargs), idkwnames = Module.hiwire.new_value(kwargs_names);
        try {
            idresult = Module.__pyproxy_apply(ptrobj, idargs, num_pos_args, idkwnames, num_kwargs)
        } catch (e) {
            Module.fatal_error(e)
        } finally {
            Module.hiwire.decref(idargs), Module.hiwire.decref(idkwnames)
        }
        return 0 === idresult && Module._pythonexc2js(), Module.hiwire.pop_value(idresult)
    }, Module.callPyObject = function (ptrobj, ...jsargs) {
        return Module.callPyObjectKwargs(ptrobj, ...jsargs, {})
    };

    class PyProxyClass {
        constructor() {
            throw new TypeError("PyProxy is not a constructor")
        }

        get [Symbol.toStringTag]() {
            return "PyProxy"
        }

        get type() {
            let ptrobj = _getPtr(this);
            return Module.hiwire.pop_value(Module.__pyproxy_type(ptrobj))
        }

        toString() {
            let jsref_repr, ptrobj = _getPtr(this);
            try {
                jsref_repr = Module.__pyproxy_repr(ptrobj)
            } catch (e) {
                Module.fatal_error(e)
            }
            return 0 === jsref_repr && Module._pythonexc2js(), Module.hiwire.pop_value(jsref_repr)
        }

        destroy(destroyed_msg) {
            this.$$.borrowed || Module.pyproxy_destroy(this, destroyed_msg)
        }

        copy() {
            let ptrobj = _getPtr(this);
            return Module.pyproxy_new(ptrobj, this.$$.cache)
        }

        toJs({
                 depth: depth = -1,
                 pyproxies: pyproxies,
                 create_pyproxies: create_pyproxies = !0,
                 dict_converter: dict_converter
             } = {}) {
            let idresult, proxies_id, ptrobj = _getPtr(this), dict_converter_id = 0;
            proxies_id = create_pyproxies ? pyproxies ? Module.hiwire.new_value(pyproxies) : Module.hiwire.new_value([]) : 0, dict_converter && (dict_converter_id = Module.hiwire.new_value(dict_converter));
            try {
                idresult = Module._python2js_custom_dict_converter(ptrobj, depth, proxies_id, dict_converter_id)
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(proxies_id), Module.hiwire.decref(dict_converter_id)
            }
            return 0 === idresult && Module._pythonexc2js(), Module.hiwire.pop_value(idresult)
        }

        supportsLength() {
            return !!(1 & this.$$flags)
        }

        supportsGet() {
            return !!(2 & this.$$flags)
        }

        supportsSet() {
            return !!(4 & this.$$flags)
        }

        supportsHas() {
            return !!(8 & this.$$flags)
        }

        isIterable() {
            return !!(48 & this.$$flags)
        }

        isIterator() {
            return !!(32 & this.$$flags)
        }

        isAwaitable() {
            return !!(64 & this.$$flags)
        }

        isBuffer() {
            return !!(128 & this.$$flags)
        }

        isCallable() {
            return !!(256 & this.$$flags)
        }
    }

    class PyProxyLengthMethods {
        get length() {
            let length, ptrobj = _getPtr(this);
            try {
                length = Module._PyObject_Size(ptrobj)
            } catch (e) {
                Module.fatal_error(e)
            }
            return -1 === length && Module._pythonexc2js(), length
        }
    }

    class PyProxyGetItemMethods {
        get(key) {
            let idresult, ptrobj = _getPtr(this), idkey = Module.hiwire.new_value(key);
            try {
                idresult = Module.__pyproxy_getitem(ptrobj, idkey)
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(idkey)
            }
            if (0 === idresult) {
                if (!Module._PyErr_Occurred()) return;
                Module._pythonexc2js()
            }
            return Module.hiwire.pop_value(idresult)
        }
    }

    class PyProxySetItemMethods {
        set(key, value) {
            let errcode, ptrobj = _getPtr(this), idkey = Module.hiwire.new_value(key),
                idval = Module.hiwire.new_value(value);
            try {
                errcode = Module.__pyproxy_setitem(ptrobj, idkey, idval)
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(idkey), Module.hiwire.decref(idval)
            }
            -1 === errcode && Module._pythonexc2js()
        }

        delete(key) {
            let errcode, ptrobj = _getPtr(this), idkey = Module.hiwire.new_value(key);
            try {
                errcode = Module.__pyproxy_delitem(ptrobj, idkey)
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(idkey)
            }
            -1 === errcode && Module._pythonexc2js()
        }
    }

    class PyProxyContainsMethods {
        has(key) {
            let result, ptrobj = _getPtr(this), idkey = Module.hiwire.new_value(key);
            try {
                result = Module.__pyproxy_contains(ptrobj, idkey)
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(idkey)
            }
            return -1 === result && Module._pythonexc2js(), 1 === result
        }
    }

    class TempError extends Error {
    }

    class PyProxyIterableMethods {
        [Symbol.iterator]() {
            let iterptr, ptrobj = _getPtr(this), token = {};
            try {
                iterptr = Module._PyObject_GetIter(ptrobj)
            } catch (e) {
                Module.fatal_error(e)
            }
            let result = function* (iterptr, token) {
                try {
                    if (0 === iterptr) throw new TempError;
                    let item;
                    for (; item = Module.__pyproxy_iter_next(iterptr);) yield Module.hiwire.pop_value(item);
                    if (Module._PyErr_Occurred()) throw new TempError
                } catch (e) {
                    e instanceof TempError ? Module._pythonexc2js() : Module.fatal_error(e)
                } finally {
                    Module.finalizationRegistry.unregister(token), Module._Py_DecRef(iterptr)
                }
            }(iterptr, token);
            return Module.finalizationRegistry.register(result, [iterptr, void 0], token), result
        }
    }

    class PyProxyIteratorMethods {
        [Symbol.iterator]() {
            return this
        }

        next(arg) {
            let idresult, done, idarg = Module.hiwire.new_value(arg);
            try {
                idresult = Module.__pyproxyGen_Send(_getPtr(this), idarg), done = 0 === idresult, done && (idresult = Module.__pyproxyGen_FetchStopIterationValue())
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(idarg)
            }
            return done && 0 === idresult && Module._pythonexc2js(), {
                done: done,
                value: Module.hiwire.pop_value(idresult)
            }
        }
    }

    let PyProxyHandlers = {
        isExtensible: () => !0,
        has: (jsobj, jskey) => !!Reflect.has(jsobj, jskey) || "symbol" != typeof jskey && (jskey.startsWith("$") && (jskey = jskey.slice(1)), function (jsobj, jskey) {
            let result, ptrobj = _getPtr(jsobj), idkey = Module.hiwire.new_value(jskey);
            try {
                result = Module.__pyproxy_hasattr(ptrobj, idkey)
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(idkey)
            }
            return -1 === result && Module._pythonexc2js(), 0 !== result
        }(jsobj, jskey)),
        get(jsobj, jskey) {
            if (jskey in jsobj || "symbol" == typeof jskey) return Reflect.get(jsobj, jskey);
            jskey.startsWith("$") && (jskey = jskey.slice(1));
            let idresult = function (jsobj, jskey) {
                let idresult, ptrobj = _getPtr(jsobj), idkey = Module.hiwire.new_value(jskey),
                    cacheId = jsobj.$$.cache.cacheId;
                try {
                    idresult = Module.__pyproxy_getattr(ptrobj, idkey, cacheId)
                } catch (e) {
                    Module.fatal_error(e)
                } finally {
                    Module.hiwire.decref(idkey)
                }
                return 0 === idresult && Module._PyErr_Occurred() && Module._pythonexc2js(), idresult
            }(jsobj, jskey);
            return 0 !== idresult ? Module.hiwire.pop_value(idresult) : void 0
        },
        set(jsobj, jskey, jsval) {
            let descr = Object.getOwnPropertyDescriptor(jsobj, jskey);
            if (descr && !descr.writable) throw new TypeError(`Cannot set read only field '${jskey}'`);
            return "symbol" == typeof jskey ? Reflect.set(jsobj, jskey, jsval) : (jskey.startsWith("$") && (jskey = jskey.slice(1)), function (jsobj, jskey, jsval) {
                let errcode, ptrobj = _getPtr(jsobj), idkey = Module.hiwire.new_value(jskey),
                    idval = Module.hiwire.new_value(jsval);
                try {
                    errcode = Module.__pyproxy_setattr(ptrobj, idkey, idval)
                } catch (e) {
                    Module.fatal_error(e)
                } finally {
                    Module.hiwire.decref(idkey), Module.hiwire.decref(idval)
                }
                -1 === errcode && Module._pythonexc2js()
            }(jsobj, jskey, jsval), !0)
        },
        deleteProperty(jsobj, jskey) {
            let descr = Object.getOwnPropertyDescriptor(jsobj, jskey);
            if (descr && !descr.writable) throw new TypeError(`Cannot delete read only field '${jskey}'`);
            return "symbol" == typeof jskey ? Reflect.deleteProperty(jsobj, jskey) : (jskey.startsWith("$") && (jskey = jskey.slice(1)), function (jsobj, jskey) {
                let errcode, ptrobj = _getPtr(jsobj), idkey = Module.hiwire.new_value(jskey);
                try {
                    errcode = Module.__pyproxy_delattr(ptrobj, idkey)
                } catch (e) {
                    Module.fatal_error(e)
                } finally {
                    Module.hiwire.decref(idkey)
                }
                -1 === errcode && Module._pythonexc2js()
            }(jsobj, jskey), !descr || descr.configurable)
        },
        ownKeys(jsobj) {
            let idresult, ptrobj = _getPtr(jsobj);
            try {
                idresult = Module.__pyproxy_ownKeys(ptrobj)
            } catch (e) {
                Module.fatal_error(e)
            }
            0 === idresult && Module._pythonexc2js();
            let result = Module.hiwire.pop_value(idresult);
            return result.push(...Reflect.ownKeys(jsobj)), result
        },
        apply: (jsobj, jsthis, jsargs) => jsobj.apply(jsthis, jsargs)
    };

    class PyProxyAwaitableMethods {
        _ensure_future() {
            let resolveHandle, rejectHandle, errcode, ptrobj = _getPtr(this),
                promise = new Promise(((resolve, reject) => {
                    resolveHandle = resolve, rejectHandle = reject
                })), resolve_handle_id = Module.hiwire.new_value(resolveHandle),
                reject_handle_id = Module.hiwire.new_value(rejectHandle);
            try {
                errcode = Module.__pyproxy_ensure_future(ptrobj, resolve_handle_id, reject_handle_id)
            } catch (e) {
                Module.fatal_error(e)
            } finally {
                Module.hiwire.decref(reject_handle_id), Module.hiwire.decref(resolve_handle_id)
            }
            return -1 === errcode && Module._pythonexc2js(), promise
        }

        then(onFulfilled, onRejected) {
            return this._ensure_future().then(onFulfilled, onRejected)
        }

        catch(onRejected) {
            return this._ensure_future().catch(onRejected)
        }

        finally(onFinally) {
            return this._ensure_future().finally(onFinally)
        }
    }

    class PyProxyCallableMethods {
        apply(jsthis, jsargs) {
            return Module.callPyObject(_getPtr(this), ...jsargs)
        }

        call(jsthis, ...jsargs) {
            return Module.callPyObject(_getPtr(this), ...jsargs)
        }

        callKwargs(...jsargs) {
            if (0 === jsargs.length) throw new TypeError("callKwargs requires at least one argument (the key word argument object)");
            let kwargs = jsargs[jsargs.length - 1];
            if (void 0 !== kwargs.constructor && "Object" !== kwargs.constructor.name) throw new TypeError("kwargs argument is not an object");
            return Module.callPyObjectKwargs(_getPtr(this), ...jsargs)
        }
    }

    PyProxyCallableMethods.prototype.prototype = Function.prototype;
    let type_to_array_map = new Map([["i8", Int8Array], ["u8", Uint8Array], ["u8clamped", Uint8ClampedArray], ["i16", Int16Array], ["u16", Uint16Array], ["i32", Int32Array], ["u32", Uint32Array], ["i32", Int32Array], ["u32", Uint32Array], ["i64", globalThis.BigInt64Array], ["u64", globalThis.BigUint64Array], ["f32", Float32Array], ["f64", Float64Array], ["dataview", DataView]]);

    class PyProxyBufferMethods {
        getBuffer(type) {
            let ArrayType;
            if (type && (ArrayType = type_to_array_map.get(type), void 0 === ArrayType)) throw new Error(`Unknown type ${type}`);
            let errcode, HEAPU32 = Module.HEAPU32, orig_stack_ptr = Module.stackSave(),
                buffer_struct_ptr = Module.stackAlloc(HEAPU32[0 + (Module._buffer_struct_size >> 2)]),
                this_ptr = _getPtr(this);
            try {
                errcode = Module.__pyproxy_get_buffer(buffer_struct_ptr, this_ptr)
            } catch (e) {
                Module.fatal_error(e)
            }
            -1 === errcode && Module._pythonexc2js();
            let startByteOffset = HEAPU32[0 + (buffer_struct_ptr >> 2)],
                minByteOffset = HEAPU32[1 + (buffer_struct_ptr >> 2)],
                maxByteOffset = HEAPU32[2 + (buffer_struct_ptr >> 2)],
                readonly = !!HEAPU32[3 + (buffer_struct_ptr >> 2)], format_ptr = HEAPU32[4 + (buffer_struct_ptr >> 2)],
                itemsize = HEAPU32[5 + (buffer_struct_ptr >> 2)],
                shape = Module.hiwire.pop_value(HEAPU32[6 + (buffer_struct_ptr >> 2)]),
                strides = Module.hiwire.pop_value(HEAPU32[7 + (buffer_struct_ptr >> 2)]),
                view_ptr = HEAPU32[8 + (buffer_struct_ptr >> 2)],
                c_contiguous = !!HEAPU32[9 + (buffer_struct_ptr >> 2)],
                f_contiguous = !!HEAPU32[10 + (buffer_struct_ptr >> 2)], format = Module.UTF8ToString(format_ptr);
            Module.stackRestore(orig_stack_ptr);
            let success = !1;
            try {
                let bigEndian = !1;
                void 0 === ArrayType && ([ArrayType, bigEndian] = Module.processBufferFormatString(format, " In this case, you can pass an explicit type argument."));
                let alignment = parseInt(ArrayType.name.replace(/[^0-9]/g, "")) / 8 || 1;
                if (bigEndian && alignment > 1) throw new Error("Javascript has no native support for big endian buffers. In this case, you can pass an explicit type argument. For instance, `getBuffer('dataview')` will return a `DataView`which has native support for reading big endian data. Alternatively, toJs will automatically convert the buffer to little endian.");
                let numBytes = maxByteOffset - minByteOffset;
                if (0 !== numBytes && (startByteOffset % alignment != 0 || minByteOffset % alignment != 0 || maxByteOffset % alignment != 0)) throw new Error(`Buffer does not have valid alignment for a ${ArrayType.name}`);
                let data, numEntries = numBytes / alignment, offset = (startByteOffset - minByteOffset) / alignment;
                data = 0 === numBytes ? new ArrayType : new ArrayType(HEAPU32.buffer, minByteOffset, numEntries);
                for (let i of strides.keys()) strides[i] /= alignment;
                return success = !0, Object.create(PyBuffer.prototype, Object.getOwnPropertyDescriptors({
                    offset: offset,
                    readonly: readonly,
                    format: format,
                    itemsize: itemsize,
                    ndim: shape.length,
                    nbytes: numBytes,
                    shape: shape,
                    strides: strides,
                    data: data,
                    c_contiguous: c_contiguous,
                    f_contiguous: f_contiguous,
                    _view_ptr: view_ptr,
                    _released: !1
                }))
            } finally {
                if (!success) try {
                    Module._PyBuffer_Release(view_ptr), Module._PyMem_Free(view_ptr)
                } catch (e) {
                    Module.fatal_error(e)
                }
            }
        }
    }

    class PyBuffer {
        constructor() {
            throw this.offset, this.readonly, this.format, this.itemsize, this.ndim, this.nbytes, this.shape, this.strides, this.data, this.c_contiguous, this.f_contiguous, new TypeError("PyBuffer is not a constructor")
        }

        release() {
            if (!this._released) {
                try {
                    Module._PyBuffer_Release(this._view_ptr), Module._PyMem_Free(this._view_ptr)
                } catch (e) {
                    Module.fatal_error(e)
                }
                this._released = !0, this.data = null
            }
        }
    }

    let globalsPropertyAccessWarned = !1,
        globalsPropertyAccessWarningMsg = "Access to pyodide.globals via pyodide.globals.key is deprecated and will be removed in version 0.18.0. Use pyodide.globals.get('key'), pyodide.globals.set('key', value), pyodide.globals.delete('key') instead.",
        NamespaceProxyHandlers = {
            has: (obj, key) => Reflect.has(obj, key) || obj.has(key), get(obj, key) {
                if (Reflect.has(obj, key)) return Reflect.get(obj, key);
                let result = obj.get(key);
                return globalsPropertyAccessWarned || void 0 === result || (console.warn(globalsPropertyAccessWarningMsg), globalsPropertyAccessWarned = !0), result
            }, set(obj, key, value) {
                if (Reflect.has(obj, key)) throw new Error(`Cannot set read only field ${key}`);
                globalsPropertyAccessWarned || (globalsPropertyAccessWarned = !0, console.warn(globalsPropertyAccessWarningMsg)), obj.set(key, value)
            }, ownKeys(obj) {
                let result = new Set(Reflect.ownKeys(obj)), iter = obj.keys();
                for (let key of iter) result.add(key);
                return iter.destroy(), Array.from(result)
            }
        };
    let pyodide_py = {}, globals = {};

    class PythonError {
        constructor() {
            this.message
        }
    }

    function runPython(code, globals = Module.globals) {
        return Module.pyodide_py.eval_code(code, globals)
    }

    async function loadPackagesFromImports(code, messageCallback, errorCallback) {
        let imports, pyimports = Module.pyodide_py.find_imports(code);
        try {
            imports = pyimports.toJs()
        } finally {
            pyimports.destroy()
        }
        if (0 === imports.length) return;
        let packageNames = Module._import_name_to_package_name, packages = new Set;
        for (let name of imports) packageNames.has(name) && packages.add(packageNames.get(name));
        packages.size && await loadPackage(Array.from(packages), messageCallback, errorCallback)
    }

    function pyimport(name) {
        return console.warn("Access to the Python global namespace via pyodide.pyimport is deprecated and will be removed in version 0.18.0. Use pyodide.globals.get('key') instead."), Module.globals.get(name)
    }

    async function runPythonAsync(code) {
        let coroutine = Module.pyodide_py.eval_code_async(code, Module.globals);
        try {
            return await coroutine
        } finally {
            coroutine.destroy()
        }
    }

    function registerJsModule(name, module) {
        Module.pyodide_py.register_js_module(name, module)
    }

    function registerComlink(Comlink) {
        Module._Comlink = Comlink
    }

    function unregisterJsModule(name) {
        Module.pyodide_py.unregister_js_module(name)
    }

    function toPy(obj, {depth: depth = -1} = {}) {
        switch (typeof obj) {
            case"string":
            case"number":
            case"boolean":
            case"bigint":
            case"undefined":
                return obj
        }
        if (!obj || Module.isPyProxy(obj)) return obj;
        let obj_id = 0, py_result = 0, result = 0;
        try {
            if (obj_id = Module.hiwire.new_value(obj), py_result = Module.__js2python_convert(obj_id, new Map, depth), 0 === py_result && Module._pythonexc2js(), Module._JsProxy_Check(py_result)) return obj;
            result = Module._python2js(py_result), 0 === result && Module._pythonexc2js()
        } finally {
            Module.hiwire.decref(obj_id), Module._Py_DecRef(py_result)
        }
        return Module.hiwire.pop_value(result)
    }

    function setInterruptBuffer(interrupt_buffer) {
    }

    Module.runPython = runPython, Module.runPythonAsync = runPythonAsync, Module.saveState = () => Module.pyodide_py._state.save_state(), Module.restoreState = state => Module.pyodide_py._state.restore_state(state), setInterruptBuffer = Module.setInterruptBuffer, Module.dump_traceback = function () {
        Module.__Py_DumpTraceback(1, Module._PyGILState_GetThisThreadState())
    };
    let fatal_error_occurred = !1;

    async function loadPyodide(config) {
        const default_config = {
            fullStdLib: !0,
            jsglobals: globalThis,
            stdin: globalThis.prompt ? globalThis.prompt : void 0
        };
        if (config = Object.assign(default_config, config), globalThis.__pyodide_module) throw globalThis.languagePluginURL ? new Error("Pyodide is already loading because languagePluginURL is defined.") : new Error("Pyodide is already loading.");
        if (globalThis.__pyodide_module = Module, loadPyodide.inProgress = !0, !config.indexURL) throw new Error("Please provide indexURL parameter to loadPyodide");
        let baseURL = config.indexURL;
        baseURL.endsWith("/") || (baseURL += "/"), Module.indexURL = baseURL;
        let packageIndexReady = initializePackageIndex(baseURL);
        setStandardStreams(config.stdin, config.stdout, config.stderr), Module.locateFile = path => baseURL + path;
        let moduleLoaded = new Promise((r => Module.postRun = r));
        const scriptSrc = `${baseURL}pyodide.asm.js`;
        await loadScript(scriptSrc), await _createPyodideModule(Module), await moduleLoaded, function () {
            let depth = 0;
            try {
                !function recurse() {
                    depth += 1, recurse()
                }()
            } catch (err) {
            }
            let recursionLimit = Math.min(depth / 25, 500);
            Module.runPythonSimple(`import sys; sys.setrecursionlimit(int(${recursionLimit}))`)
        }();
        let pyodide = function () {
            const FS = Module.FS;
            let namespace = {
                globals: globals,
                FS: FS,
                pyodide_py: pyodide_py,
                version: "",
                loadPackage: loadPackage,
                loadPackagesFromImports: loadPackagesFromImports,
                loadedPackages: loadedPackages,
                isPyProxy: isPyProxy,
                pyimport: pyimport,
                runPython: runPython,
                runPythonAsync: runPythonAsync,
                registerJsModule: registerJsModule,
                unregisterJsModule: unregisterJsModule,
                setInterruptBuffer: setInterruptBuffer,
                toPy: toPy,
                registerComlink: registerComlink,
                PythonError: PythonError,
                PyBuffer: PyBuffer
            };
            return namespace._module = Module, Module.public_api = namespace, namespace
        }();
        var ns;
        return Module.runPythonSimple('\ndef temp(pyodide_js, Module, jsglobals):\n  from _pyodide._importhook import register_js_finder\n  jsfinder = register_js_finder()\n  jsfinder.register_js_module("js", jsglobals)\n  jsfinder.register_js_module("pyodide_js", pyodide_js)\n\n  import pyodide\n  import __main__\n  import builtins\n\n  globals = __main__.__dict__\n  globals.update(builtins.__dict__)\n\n  Module.version = pyodide.__version__\n  Module.globals = globals\n  Module.builtins = builtins.__dict__\n  Module.pyodide_py = pyodide\n  print("Python initialization complete")\n'), Module.init_dict.get("temp")(pyodide, Module, config.jsglobals), Module.globals = (ns = Module.globals, new Proxy(ns, NamespaceProxyHandlers)), pyodide.globals = Module.globals, pyodide.pyodide_py = Module.pyodide_py, pyodide.version = Module.version, await packageIndexReady, config.fullStdLib && await loadPackage(["distutils"]), pyodide
    }

    Module.fatal_error = function (e) {
        if (fatal_error_occurred) return console.error("Recursive call to fatal_error. Inner error was:"), void console.error(e);
        fatal_error_occurred = !0, console.error("Pyodide has suffered a fatal error. Please report this to the Pyodide maintainers."), console.error("The cause of the fatal error was:"), Module.inTestHoist ? (console.error(e.toString()), console.error(e.stack)) : console.error(e);
        try {
            Module.dump_traceback();
            for (let key of Object.keys(Module.public_api)) key.startsWith("_") || "version" === key || Object.defineProperty(Module.public_api, key, {
                enumerable: !0,
                configurable: !0,
                get: () => {
                    throw new Error("Pyodide already fatally failed and can no longer be used.")
                }
            });
            Module.on_fatal && Module.on_fatal(e)
        } catch (err2) {
            console.error("Another error occurred while handling the fatal error:"), console.error(err2)
        }
        throw e
    }, Module.runPythonSimple = function (code) {
        let errcode, code_c_string = Module.stringToNewUTF8(code);
        try {
            errcode = Module._run_python_simple_inner(code_c_string)
        } catch (e) {
            Module.fatal_error(e)
        } finally {
            Module._free(code_c_string)
        }
        -1 === errcode && Module._pythonexc2js()
    }, globalThis.loadPyodide = loadPyodide, globalThis.languagePluginUrl && (console.warn("languagePluginUrl is deprecated and will be removed in version 0.18.0, instead use loadPyodide({ indexURL : <some_url>})"), globalThis.languagePluginLoader = loadPyodide({indexURL: globalThis.languagePluginUrl}).then((pyodide => self.pyodide = pyodide))), exports.loadPyodide = loadPyodide, Object.defineProperty(exports, "__esModule", {value: !0})
}));
//# sourceMappingURL=pyodide.js.map
