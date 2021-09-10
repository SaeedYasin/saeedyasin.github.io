
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.42.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\layout\PageCentered.svelte generated by Svelte v3.42.4 */

    const file$5 = "src\\components\\layout\\PageCentered.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "svelte-9b3bbl");
    			add_location(div, file$5, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PageCentered', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PageCentered> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class PageCentered extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PageCentered",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    function undoable(store) {
      const initial = get_store_value(store);

      const state = writable({
        value: initial,
        stack: [initial],
        index: 0,
      });

      const undo = () => {
        state.update(({ stack, index, value }) => {
          if (index > 0) store.set((value = stack[--index]));
          return { value, stack, index };
        });
      };

      const redo = () => {
        state.update(({ stack, index, value }) => {
          if (index < stack.length - 1) store.set((value = stack[++index]));
          return { value, stack, index };
        });
      };

      const update = (fn) => {
        store.update((old_value) => {
          const value = fn(old_value);

          state.update(({ stack, index }) => {
            stack.length = ++index; // clear forward history
            stack[index] = value;
            return { value, stack, index };
          });

          return value;
        });
      };

      const set = (value) => {
        update(() => value);
      };

      const cleanup = () => {
        const current = get_store_value(state);
        state.set({
          value: current.value,
          stack: [current.value],
          index: 0,
        });
      };

      const value = derived(state, ({ value }) => value);
      const urdoStore = { subscribe: value.subscribe, update, set };

      const canUndo = derived(state, ({ index }) => index > 0);
      const canRedo = derived(
        state,
        ({ index, stack }) => index < stack.length - 1
      );

      return [urdoStore, undo, redo, canUndo, canRedo, cleanup];
    }

    const read = (key) => {
      try {
        return JSON.parse(localStorage[key]);
      } catch (e) {
        console.warn("key", key, "not found in local storage");
      }
    };

    function persistent(key, initial) {
      const store = writable(read(key) || initial, () => {
        return store.subscribe((value) => {
          localStorage[key] = JSON.stringify(value);
        });
      });

      return store;
    }

    const timeStamp = () => {
      const date = new Date();
      const hour = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      const milliseconds = date.getMilliseconds();

      return [
        "[%c" +
          (hour < 10 ? "0" + hour : hour) +
          ":" +
          (minutes < 10 ? "0" + minutes : minutes) +
          ":" +
          (seconds < 10 ? "0" + seconds : seconds) +
          "." +
          ("00" + milliseconds).slice(-3) +
          "%c]",
        "color: gold",
        "color: unset",
      ];
    };

    function log(store, name) {
      let previousValue = get_store_value(store);
      const unsubscribe = store.subscribe((value) => {
        const entryName = (name || "value") + ":";
        console.groupCollapsed(...timeStamp(), entryName, value);
        console.log("Previous", entryName, previousValue);
        console.groupEnd();
        previousValue = value;
      });
      return [store, unsubscribe];
    }

    const config = {
          apiUrl: "http://localhost:5554",
        };

    const storeLabel = "count";
    const [countStore, logCleanup] = log(persistent(storeLabel, 10), storeLabel);
    const [count, _undo, _redo, canUndo, canRedo, urdoCleanup] =
      undoable(countStore);

    const increment = () => {
      count.update((count) => +count + 1);

      // send this action to backend
      console.log("Sending increment action to", config.apiUrl);
    };

    const decrement = () => {
      count.update((count) => +count - 1);

      // send this action to backend
      console.log("Sending decrement action to", config.apiUrl);
    };

    const undo = () => {
      _undo();
    };

    const redo = () => {
      _redo();
    };

    const cleanup = () => {
      logCleanup();
      urdoCleanup();
    };

    var countSlice = {
      count: {
        subscribe: count.subscribe,
      },
      actions: {
        increment,
        decrement,
      },
      urdo: { undo, redo, canUndo, canRedo },
      cleanup,
    };

    /* src\components\counter\Counter.svelte generated by Svelte v3.42.4 */
    const file$4 = "src\\components\\counter\\Counter.svelte";

    function create_fragment$4(ctx) {
    	let div0;
    	let t0;
    	let t1;
    	let t2;
    	let div1;
    	let button0;
    	let t4;
    	let button1;
    	let t6;
    	let div2;
    	let button2;
    	let img0;
    	let img0_src_value;
    	let button2_disabled_value;
    	let t7;
    	let button3;
    	let img1;
    	let img1_src_value;
    	let button3_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = text("Count: ");
    			t1 = text(/*$count*/ ctx[0]);
    			t2 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "+";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "-";
    			t6 = space();
    			div2 = element("div");
    			button2 = element("button");
    			img0 = element("img");
    			t7 = space();
    			button3 = element("button");
    			img1 = element("img");
    			attr_dev(div0, "class", "title");
    			add_location(div0, file$4, 24, 0, 574);
    			attr_dev(button0, "class", "btn btn-success svelte-1epfuqu");
    			add_location(button0, file$4, 26, 2, 623);
    			attr_dev(button1, "class", "btn btn-danger svelte-1epfuqu");
    			add_location(button1, file$4, 27, 2, 689);
    			add_location(div1, file$4, 25, 0, 615);
    			if (!src_url_equal(img0.src, img0_src_value = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAABvUlEQVRoge3YP6jOURzH8S9XCHFJShluMkhWFqUMVsqfIpsUsSmjQTJbLXeQ8S7KyELkXte16EaIwSALBvInvPh5vjfPwuL5Pdf36XnPv36f8z7fczrfcyKGDPn/wCpcw+UoLjGlw3QUlphMiRcYi2oYIImpocR8g9FBqMTooEjcG0rMNwaoEjN6yzu8wgNcxQXsx9pqIn/iG+7iJFa2IbOmS+YpNvzDv5ZiPbZgBw7iPK7jY5fUG5xtvu+1zGrc74XMXzKW4QhudQk9wfZyMl1ZuzCbWU2lDrUhM90nmcW4lFlfcaCsTAPOZdZ7bI3K7TvGM6uZwIVtHpRtL7MVeJlZh9sI6KfM0cyZ6UdH3JqMzuZ/mzmb+3FbfNhKSPzKmciM021lzMk0J/SNFjOOpchEVAbbUmQyKoOxFHkeldHpxxo+RGWwJEU+RWWwLkVeR2Wwaa69j8pgZ4rcicrgeIqMR2VwMUXORGX8vjrsjqrotPJf8BnLoyrYk9W4HZXBlfL7Q2dZNS+U37ExqoJTWY2bURUswOMU2RtVwb6UeIaRKFyN2RQ5EVXREXmULzWLojIYaYTmexxDhvycgR+YNwSh738ajwAAAABJRU5ErkJggg==")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "undo");
    			attr_dev(img0, "width", "20px");
    			attr_dev(img0, "height", "20px");
    			add_location(img0, file$4, 31, 4, 841);
    			attr_dev(button2, "class", "btn btn-warning svelte-1epfuqu");
    			button2.disabled = button2_disabled_value = !/*$canUndo*/ ctx[1];
    			add_location(button2, file$4, 30, 2, 767);
    			if (!src_url_equal(img1.src, img1_src_value = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAByklEQVRoge3YO4xOQRiH8dcl4rKyLttIREJHolJIRKFSKUhsIioJjWwroiJRKLVKoRLRaDQiWQWy+GiWwiWhUkjQiHt+cnyvfBsJmjnf7uyepzvN/50nM3PmnYno6Jif4ApuYDRqBj19pqqWwUY8T5ke1kWtzGeZR53MHJ6Z9VEr5rHM405mwc4MxnAQ53A91/YbfFCWHtaUHvwoJnAPPwoPuH0RrMBpvJ9R4BNu4izGsQvbsAHL59ypj50zghsmcRgrixT4u8RDrI0S4BA+Z/A09hQJHrLEOL5n8AUsKxL8f4kHJSW242MGnykSOgsSi/Ov1HC5SOhstPP6G7nhNVYVC/63xP02zorfV9EjRYOHLLE1w9+1tbn/kJgqLpFFTmSBq8XDBzWmW398wLUscrSVAv0at7IjaO8FJddrw46oGbxKkU1RMwaHYPE+aqjgS4q01o4MBbxNkbGoGbxMkc1RMwY91u6oGVxMkWNRMziZIuejZrA3Re5GzWAEX/ENq6NmcCdnZV/UDE6lyKWoGWxJkebFcCRqBrdTZiJqBvtT5FnzGBG1giV4kTIHomZwPEWeYFHUCpbmjfFp1SINjUCzzH59dHQsDH4COwwEt7yqLtUAAAAASUVORK5CYII=")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "redo");
    			attr_dev(img1, "width", "20px");
    			attr_dev(img1, "height", "20px");
    			add_location(img1, file$4, 34, 4, 1701);
    			attr_dev(button3, "class", "btn btn-info svelte-1epfuqu");
    			button3.disabled = button3_disabled_value = !/*$canRedo*/ ctx[2];
    			add_location(button3, file$4, 33, 2, 1630);
    			add_location(div2, file$4, 29, 0, 759);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button0);
    			append_dev(div1, t4);
    			append_dev(div1, button1);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, button2);
    			append_dev(button2, img0);
    			append_dev(div2, t7);
    			append_dev(div2, button3);
    			append_dev(button3, img1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*handleKeydown*/ ctx[10], false, false, false),
    					listen_dev(button0, "click", /*increment*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*decrement*/ ctx[5], false, false, false),
    					listen_dev(button2, "click", /*undo*/ ctx[6], false, false, false),
    					listen_dev(button3, "click", /*redo*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$count*/ 1) set_data_dev(t1, /*$count*/ ctx[0]);

    			if (dirty & /*$canUndo*/ 2 && button2_disabled_value !== (button2_disabled_value = !/*$canUndo*/ ctx[1])) {
    				prop_dev(button2, "disabled", button2_disabled_value);
    			}

    			if (dirty & /*$canRedo*/ 4 && button3_disabled_value !== (button3_disabled_value = !/*$canRedo*/ ctx[2])) {
    				prop_dev(button3, "disabled", button3_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $count;
    	let $canUndo;
    	let $canRedo;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Counter', slots, []);
    	const { count, actions, urdo, cleanup } = countSlice;
    	validate_store(count, 'count');
    	component_subscribe($$self, count, value => $$invalidate(0, $count = value));
    	const { increment, decrement } = actions;
    	const { undo, redo, canUndo, canRedo } = urdo;
    	validate_store(canUndo, 'canUndo');
    	component_subscribe($$self, canUndo, value => $$invalidate(1, $canUndo = value));
    	validate_store(canRedo, 'canRedo');
    	component_subscribe($$self, canRedo, value => $$invalidate(2, $canRedo = value));
    	onDestroy(cleanup);

    	const handleKeydown = e => {
    		if (e.ctrlKey) {
    			if (e.which === 89) {
    				e.preventDefault();
    				redo(); // (Ctrl+Y)
    			} else if (e.which === 90) {
    				e.preventDefault();
    				undo(); // (Ctrl+Z)
    			}
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Counter> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onDestroy,
    		countSlice,
    		count,
    		actions,
    		urdo,
    		cleanup,
    		increment,
    		decrement,
    		undo,
    		redo,
    		canUndo,
    		canRedo,
    		handleKeydown,
    		$count,
    		$canUndo,
    		$canRedo
    	});

    	return [
    		$count,
    		$canUndo,
    		$canRedo,
    		count,
    		increment,
    		decrement,
    		undo,
    		redo,
    		canUndo,
    		canRedo,
    		handleKeydown
    	];
    }

    class Counter extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Counter",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\components\ui\popup\tooltip\TooltipBody.svelte generated by Svelte v3.42.4 */

    const file$3 = "src\\components\\ui\\popup\\tooltip\\TooltipBody.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*title*/ ctx[0]);
    			set_style(div, "top", /*y*/ ctx[2] + 5 + "px");
    			set_style(div, "left", /*x*/ ctx[1] + 5 + "px");
    			attr_dev(div, "class", "svelte-l6sunc");
    			add_location(div, file$3, 6, 0, 72);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*title*/ 1) set_data_dev(t, /*title*/ ctx[0]);

    			if (dirty & /*y*/ 4) {
    				set_style(div, "top", /*y*/ ctx[2] + 5 + "px");
    			}

    			if (dirty & /*x*/ 2) {
    				set_style(div, "left", /*x*/ ctx[1] + 5 + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TooltipBody', slots, []);
    	let { title } = $$props;
    	let { x } = $$props;
    	let { y } = $$props;
    	const writable_props = ['title', 'x', 'y'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TooltipBody> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('x' in $$props) $$invalidate(1, x = $$props.x);
    		if ('y' in $$props) $$invalidate(2, y = $$props.y);
    	};

    	$$self.$capture_state = () => ({ title, x, y });

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('x' in $$props) $$invalidate(1, x = $$props.x);
    		if ('y' in $$props) $$invalidate(2, y = $$props.y);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, x, y];
    }

    class TooltipBody extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { title: 0, x: 1, y: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TooltipBody",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !('title' in props)) {
    			console.warn("<TooltipBody> was created without expected prop 'title'");
    		}

    		if (/*x*/ ctx[1] === undefined && !('x' in props)) {
    			console.warn("<TooltipBody> was created without expected prop 'x'");
    		}

    		if (/*y*/ ctx[2] === undefined && !('y' in props)) {
    			console.warn("<TooltipBody> was created without expected prop 'y'");
    		}
    	}

    	get title() {
    		throw new Error("<TooltipBody>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<TooltipBody>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get x() {
    		throw new Error("<TooltipBody>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set x(value) {
    		throw new Error("<TooltipBody>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get y() {
    		throw new Error("<TooltipBody>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set y(value) {
    		throw new Error("<TooltipBody>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function tooltip(element) {
      let title;
      let tooltipBody;

      const mouseOver = (event) => {
        // To prevent showing the default browser tooltip
        // remove the `title` attribute
        title = element.getAttribute("title");
        element.removeAttribute("title");

        tooltipBody = new TooltipBody({
          props: {
            title: title,
            x: event.pageX,
            y: event.pageY,
          },
          target: document.body,
        });
      };

      const mouseMove = (event) => {
        tooltipBody.$set({
          x: event.pageX,
          y: event.pageY,
        });
      };

      const mouseLeave = () => {
        tooltipBody.$destroy();
        // Restore the `title` attribute
        element.setAttribute("title", title);
      };

      element.addEventListener("mouseover", mouseOver);
      element.addEventListener("mouseleave", mouseLeave);
      element.addEventListener("mousemove", mouseMove);

      return {
        destroy() {
          element.removeEventListener("mouseover", mouseOver);
          element.removeEventListener("mouseleave", mouseLeave);
          element.removeEventListener("mousemove", mouseMove);
        },
      };
    }

    const digitCharacters = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
        "j",
        "k",
        "l",
        "m",
        "n",
        "o",
        "p",
        "q",
        "r",
        "s",
        "t",
        "u",
        "v",
        "w",
        "x",
        "y",
        "z",
        "#",
        "$",
        "%",
        "*",
        "+",
        ",",
        "-",
        ".",
        ":",
        ";",
        "=",
        "?",
        "@",
        "[",
        "]",
        "^",
        "_",
        "{",
        "|",
        "}",
        "~"
    ];
    const decode83 = (str) => {
        let value = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            const digit = digitCharacters.indexOf(c);
            value = value * 83 + digit;
        }
        return value;
    };

    const sRGBToLinear = (value) => {
        let v = value / 255;
        if (v <= 0.04045) {
            return v / 12.92;
        }
        else {
            return Math.pow((v + 0.055) / 1.055, 2.4);
        }
    };
    const linearTosRGB = (value) => {
        let v = Math.max(0, Math.min(1, value));
        if (v <= 0.0031308) {
            return Math.round(v * 12.92 * 255 + 0.5);
        }
        else {
            return Math.round((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5);
        }
    };
    const sign = (n) => (n < 0 ? -1 : 1);
    const signPow = (val, exp) => sign(val) * Math.pow(Math.abs(val), exp);

    class ValidationError extends Error {
        constructor(message) {
            super(message);
            this.name = "ValidationError";
            this.message = message;
        }
    }

    /**
     * Returns an error message if invalid or undefined if valid
     * @param blurhash
     */
    const validateBlurhash = (blurhash) => {
        if (!blurhash || blurhash.length < 6) {
            throw new ValidationError("The blurhash string must be at least 6 characters");
        }
        const sizeFlag = decode83(blurhash[0]);
        const numY = Math.floor(sizeFlag / 9) + 1;
        const numX = (sizeFlag % 9) + 1;
        if (blurhash.length !== 4 + 2 * numX * numY) {
            throw new ValidationError(`blurhash length mismatch: length is ${blurhash.length} but it should be ${4 + 2 * numX * numY}`);
        }
    };
    const decodeDC = (value) => {
        const intR = value >> 16;
        const intG = (value >> 8) & 255;
        const intB = value & 255;
        return [sRGBToLinear(intR), sRGBToLinear(intG), sRGBToLinear(intB)];
    };
    const decodeAC = (value, maximumValue) => {
        const quantR = Math.floor(value / (19 * 19));
        const quantG = Math.floor(value / 19) % 19;
        const quantB = value % 19;
        const rgb = [
            signPow((quantR - 9) / 9, 2.0) * maximumValue,
            signPow((quantG - 9) / 9, 2.0) * maximumValue,
            signPow((quantB - 9) / 9, 2.0) * maximumValue
        ];
        return rgb;
    };
    const decode = (blurhash, width, height, punch) => {
        validateBlurhash(blurhash);
        punch = punch | 1;
        const sizeFlag = decode83(blurhash[0]);
        const numY = Math.floor(sizeFlag / 9) + 1;
        const numX = (sizeFlag % 9) + 1;
        const quantisedMaximumValue = decode83(blurhash[1]);
        const maximumValue = (quantisedMaximumValue + 1) / 166;
        const colors = new Array(numX * numY);
        for (let i = 0; i < colors.length; i++) {
            if (i === 0) {
                const value = decode83(blurhash.substring(2, 6));
                colors[i] = decodeDC(value);
            }
            else {
                const value = decode83(blurhash.substring(4 + i * 2, 6 + i * 2));
                colors[i] = decodeAC(value, maximumValue * punch);
            }
        }
        const bytesPerRow = width * 4;
        const pixels = new Uint8ClampedArray(bytesPerRow * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0;
                let g = 0;
                let b = 0;
                for (let j = 0; j < numY; j++) {
                    for (let i = 0; i < numX; i++) {
                        const basis = Math.cos((Math.PI * x * i) / width) *
                            Math.cos((Math.PI * y * j) / height);
                        let color = colors[i + j * numX];
                        r += color[0] * basis;
                        g += color[1] * basis;
                        b += color[2] * basis;
                    }
                }
                let intR = linearTosRGB(r);
                let intG = linearTosRGB(g);
                let intB = linearTosRGB(b);
                pixels[4 * x + 0 + y * bytesPerRow] = intR;
                pixels[4 * x + 1 + y * bytesPerRow] = intG;
                pixels[4 * x + 2 + y * bytesPerRow] = intB;
                pixels[4 * x + 3 + y * bytesPerRow] = 255; // alpha
            }
        }
        return pixels;
    };
    var decode$1 = decode;

    /* node_modules\svelte-waypoint\src\Waypoint.svelte generated by Svelte v3.42.4 */
    const file$2 = "node_modules\\svelte-waypoint\\src\\Waypoint.svelte";

    // (139:2) {#if visible}
    function create_if_block$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[11].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1024)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[10],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[10])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[10], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(139:2) {#if visible}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let div_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*visible*/ ctx[3] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div, "class", div_class_value = "wrapper " + /*className*/ ctx[2] + " " + /*c*/ ctx[0] + " svelte-142y8oi");
    			attr_dev(div, "style", /*style*/ ctx[1]);
    			add_location(div, file$2, 137, 0, 3091);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			current = true;

    			if (!mounted) {
    				dispose = action_destroyer(/*waypoint*/ ctx[4].call(null, div));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*visible*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*visible*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*className, c*/ 5 && div_class_value !== (div_class_value = "wrapper " + /*className*/ ctx[2] + " " + /*c*/ ctx[0] + " svelte-142y8oi")) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if (!current || dirty & /*style*/ 2) {
    				attr_dev(div, "style", /*style*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function throttleFn(fn, time) {
    	let last, deferTimer;

    	return () => {
    		const now = +new Date();

    		if (last && now < last + time) {
    			// hold on to it
    			clearTimeout(deferTimer);

    			deferTimer = setTimeout(
    				function () {
    					last = now;
    					fn();
    				},
    				time
    			);
    		} else {
    			last = now;
    			fn();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Waypoint', slots, ['default']);
    	const dispatch = createEventDispatcher();
    	let { offset = 0 } = $$props;
    	let { throttle = 250 } = $$props;
    	let { c = '' } = $$props;
    	let { style = '' } = $$props;
    	let { once = true } = $$props;
    	let { threshold = 1.0 } = $$props;
    	let { disabled = false } = $$props;
    	let { class: className = "" } = $$props;
    	let visible = disabled;
    	let wasVisible = false;
    	let intersecting = false;

    	let removeHandlers = () => {
    		
    	};

    	function callEvents(wasVisible, observer, node) {
    		if (visible && !wasVisible) {
    			dispatch('enter');
    			return;
    		}

    		if (wasVisible && !intersecting) {
    			dispatch('leave');
    		}

    		if (once && wasVisible && !intersecting) {
    			removeHandlers();
    		}
    	}

    	function waypoint(node) {
    		if (!window || disabled) return;

    		if (window.IntersectionObserver && window.IntersectionObserverEntry) {
    			const observer = new IntersectionObserver(([{ isIntersecting }]) => {
    					wasVisible = visible;
    					intersecting = isIntersecting;

    					if (wasVisible && once && !isIntersecting) {
    						callEvents(wasVisible);
    						return;
    					}

    					$$invalidate(3, visible = isIntersecting);
    					callEvents(wasVisible);
    				},
    			{ rootMargin: offset + 'px', threshold });

    			observer.observe(node);
    			removeHandlers = () => observer.unobserve(node);
    			return removeHandlers;
    		}

    		function checkIsVisible() {
    			// Kudos https://github.com/twobin/react-lazyload/blob/master/src/index.jsx#L93
    			if (!(node.offsetWidth || node.offsetHeight || node.getClientRects().length)) return;

    			let top;
    			let height;

    			try {
    				({ top, height } = node.getBoundingClientRect());
    			} catch(e) {
    				({ top, height } = defaultBoundingClientRect);
    			}

    			const windowInnerHeight = window.innerHeight || document.documentElement.clientHeight;
    			wasVisible = visible;
    			intersecting = top - offset <= windowInnerHeight && top + height + offset >= 0;

    			if (wasVisible && once && !isIntersecting) {
    				callEvents(wasVisible, observer);
    				return;
    			}

    			$$invalidate(3, visible = intersecting);
    			callEvents(wasVisible);
    		}

    		checkIsVisible();
    		const throttled = throttleFn(checkIsVisible, throttle);
    		window.addEventListener('scroll', throttled);
    		window.addEventListener('resize', throttled);

    		removeHandlers = () => {
    			window.removeEventListener('scroll', throttled);
    			window.removeEventListener('resize', throttled);
    		};

    		return removeHandlers;
    	}

    	const writable_props = ['offset', 'throttle', 'c', 'style', 'once', 'threshold', 'disabled', 'class'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Waypoint> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('offset' in $$props) $$invalidate(5, offset = $$props.offset);
    		if ('throttle' in $$props) $$invalidate(6, throttle = $$props.throttle);
    		if ('c' in $$props) $$invalidate(0, c = $$props.c);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('once' in $$props) $$invalidate(7, once = $$props.once);
    		if ('threshold' in $$props) $$invalidate(8, threshold = $$props.threshold);
    		if ('disabled' in $$props) $$invalidate(9, disabled = $$props.disabled);
    		if ('class' in $$props) $$invalidate(2, className = $$props.class);
    		if ('$$scope' in $$props) $$invalidate(10, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		onDestroy,
    		dispatch,
    		offset,
    		throttle,
    		c,
    		style,
    		once,
    		threshold,
    		disabled,
    		className,
    		visible,
    		wasVisible,
    		intersecting,
    		removeHandlers,
    		throttleFn,
    		callEvents,
    		waypoint
    	});

    	$$self.$inject_state = $$props => {
    		if ('offset' in $$props) $$invalidate(5, offset = $$props.offset);
    		if ('throttle' in $$props) $$invalidate(6, throttle = $$props.throttle);
    		if ('c' in $$props) $$invalidate(0, c = $$props.c);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('once' in $$props) $$invalidate(7, once = $$props.once);
    		if ('threshold' in $$props) $$invalidate(8, threshold = $$props.threshold);
    		if ('disabled' in $$props) $$invalidate(9, disabled = $$props.disabled);
    		if ('className' in $$props) $$invalidate(2, className = $$props.className);
    		if ('visible' in $$props) $$invalidate(3, visible = $$props.visible);
    		if ('wasVisible' in $$props) wasVisible = $$props.wasVisible;
    		if ('intersecting' in $$props) intersecting = $$props.intersecting;
    		if ('removeHandlers' in $$props) removeHandlers = $$props.removeHandlers;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		c,
    		style,
    		className,
    		visible,
    		waypoint,
    		offset,
    		throttle,
    		once,
    		threshold,
    		disabled,
    		$$scope,
    		slots
    	];
    }

    class Waypoint extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			offset: 5,
    			throttle: 6,
    			c: 0,
    			style: 1,
    			once: 7,
    			threshold: 8,
    			disabled: 9,
    			class: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Waypoint",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get offset() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set offset(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get throttle() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set throttle(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get c() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set c(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get once() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set once(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get threshold() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set threshold(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Waypoint>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Waypoint>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-image\src\Image.svelte generated by Svelte v3.42.4 */
    const file$1 = "node_modules\\svelte-image\\src\\Image.svelte";

    // (92:6) {:else}
    function create_else_block(ctx) {
    	let img;
    	let img_class_value;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", img_class_value = "placeholder " + /*placeholderClass*/ ctx[14] + " svelte-ilz1a1");
    			if (!src_url_equal(img.src, img_src_value = /*src*/ ctx[4])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*alt*/ ctx[1]);
    			toggle_class(img, "blur", /*blur*/ ctx[8]);
    			add_location(img, file$1, 92, 8, 2107);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*placeholderClass*/ 16384 && img_class_value !== (img_class_value = "placeholder " + /*placeholderClass*/ ctx[14] + " svelte-ilz1a1")) {
    				attr_dev(img, "class", img_class_value);
    			}

    			if (dirty & /*src*/ 16 && !src_url_equal(img.src, img_src_value = /*src*/ ctx[4])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*alt*/ 2) {
    				attr_dev(img, "alt", /*alt*/ ctx[1]);
    			}

    			if (dirty & /*placeholderClass, blur*/ 16640) {
    				toggle_class(img, "blur", /*blur*/ ctx[8]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(92:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (90:6) {#if blurhash}
    function create_if_block(ctx) {
    	let canvas;
    	let canvas_width_value;
    	let canvas_height_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			canvas = element("canvas");
    			attr_dev(canvas, "class", "placeholder svelte-ilz1a1");
    			attr_dev(canvas, "width", canvas_width_value = /*blurhashSize*/ ctx[16].width);
    			attr_dev(canvas, "height", canvas_height_value = /*blurhashSize*/ ctx[16].height);
    			add_location(canvas, file$1, 90, 8, 1979);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, canvas, anchor);

    			if (!mounted) {
    				dispose = action_destroyer(/*decodeBlurhash*/ ctx[20].call(null, canvas));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*blurhashSize*/ 65536 && canvas_width_value !== (canvas_width_value = /*blurhashSize*/ ctx[16].width)) {
    				attr_dev(canvas, "width", canvas_width_value);
    			}

    			if (dirty & /*blurhashSize*/ 65536 && canvas_height_value !== (canvas_height_value = /*blurhashSize*/ ctx[16].height)) {
    				attr_dev(canvas, "height", canvas_height_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(canvas);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(90:6) {#if blurhash}",
    		ctx
    	});

    	return block;
    }

    // (79:0) <Waypoint   class="{wrapperClass}"   style="min-height: 100px; width: 100%;"   once   {threshold}   {offset}   disabled="{!lazy}" >
    function create_default_slot$1(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let picture;
    	let source0;
    	let t2;
    	let source1;
    	let t3;
    	let img;
    	let img_src_value;
    	let img_class_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*blurhash*/ ctx[15]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			if_block.c();
    			t1 = space();
    			picture = element("picture");
    			source0 = element("source");
    			t2 = space();
    			source1 = element("source");
    			t3 = space();
    			img = element("img");
    			set_style(div0, "width", "100%");
    			set_style(div0, "padding-bottom", /*ratio*/ ctx[7]);
    			add_location(div0, file$1, 88, 6, 1895);
    			attr_dev(source0, "type", "image/webp");
    			attr_dev(source0, "srcset", /*srcsetWebp*/ ctx[6]);
    			attr_dev(source0, "sizes", /*sizes*/ ctx[9]);
    			add_location(source0, file$1, 95, 8, 2213);
    			attr_dev(source1, "srcset", /*srcset*/ ctx[5]);
    			attr_dev(source1, "sizes", /*sizes*/ ctx[9]);
    			add_location(source1, file$1, 96, 8, 2280);
    			if (!src_url_equal(img.src, img_src_value = /*src*/ ctx[4])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", img_class_value = "main " + /*c*/ ctx[0] + " " + /*className*/ ctx[17] + " svelte-ilz1a1");
    			attr_dev(img, "alt", /*alt*/ ctx[1]);
    			attr_dev(img, "width", /*width*/ ctx[2]);
    			attr_dev(img, "height", /*height*/ ctx[3]);
    			add_location(img, file$1, 97, 8, 2316);
    			add_location(picture, file$1, 94, 6, 2195);
    			set_style(div1, "position", "relative");
    			set_style(div1, "overflow", "hidden");
    			add_location(div1, file$1, 87, 4, 1837);
    			set_style(div2, "position", "relative");
    			set_style(div2, "width", "100%");
    			attr_dev(div2, "class", "svelte-ilz1a1");
    			toggle_class(div2, "loaded", /*loaded*/ ctx[18]);
    			add_location(div2, file$1, 86, 2, 1773);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t0);
    			if_block.m(div1, null);
    			append_dev(div1, t1);
    			append_dev(div1, picture);
    			append_dev(picture, source0);
    			append_dev(picture, t2);
    			append_dev(picture, source1);
    			append_dev(picture, t3);
    			append_dev(picture, img);

    			if (!mounted) {
    				dispose = action_destroyer(/*load*/ ctx[19].call(null, img));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*ratio*/ 128) {
    				set_style(div0, "padding-bottom", /*ratio*/ ctx[7]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t1);
    				}
    			}

    			if (dirty & /*srcsetWebp*/ 64) {
    				attr_dev(source0, "srcset", /*srcsetWebp*/ ctx[6]);
    			}

    			if (dirty & /*sizes*/ 512) {
    				attr_dev(source0, "sizes", /*sizes*/ ctx[9]);
    			}

    			if (dirty & /*srcset*/ 32) {
    				attr_dev(source1, "srcset", /*srcset*/ ctx[5]);
    			}

    			if (dirty & /*sizes*/ 512) {
    				attr_dev(source1, "sizes", /*sizes*/ ctx[9]);
    			}

    			if (dirty & /*src*/ 16 && !src_url_equal(img.src, img_src_value = /*src*/ ctx[4])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*c, className*/ 131073 && img_class_value !== (img_class_value = "main " + /*c*/ ctx[0] + " " + /*className*/ ctx[17] + " svelte-ilz1a1")) {
    				attr_dev(img, "class", img_class_value);
    			}

    			if (dirty & /*alt*/ 2) {
    				attr_dev(img, "alt", /*alt*/ ctx[1]);
    			}

    			if (dirty & /*width*/ 4) {
    				attr_dev(img, "width", /*width*/ ctx[2]);
    			}

    			if (dirty & /*height*/ 8) {
    				attr_dev(img, "height", /*height*/ ctx[3]);
    			}

    			if (dirty & /*loaded*/ 262144) {
    				toggle_class(div2, "loaded", /*loaded*/ ctx[18]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(79:0) <Waypoint   class=\\\"{wrapperClass}\\\"   style=\\\"min-height: 100px; width: 100%;\\\"   once   {threshold}   {offset}   disabled=\\\"{!lazy}\\\" >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let waypoint;
    	let current;

    	waypoint = new Waypoint({
    			props: {
    				class: /*wrapperClass*/ ctx[13],
    				style: "min-height: 100px; width: 100%;",
    				once: true,
    				threshold: /*threshold*/ ctx[11],
    				offset: /*offset*/ ctx[10],
    				disabled: !/*lazy*/ ctx[12],
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(waypoint.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(waypoint, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const waypoint_changes = {};
    			if (dirty & /*wrapperClass*/ 8192) waypoint_changes.class = /*wrapperClass*/ ctx[13];
    			if (dirty & /*threshold*/ 2048) waypoint_changes.threshold = /*threshold*/ ctx[11];
    			if (dirty & /*offset*/ 1024) waypoint_changes.offset = /*offset*/ ctx[10];
    			if (dirty & /*lazy*/ 4096) waypoint_changes.disabled = !/*lazy*/ ctx[12];

    			if (dirty & /*$$scope, loaded, src, c, className, alt, width, height, srcset, sizes, srcsetWebp, blurhashSize, blurhash, placeholderClass, blur, ratio*/ 2606079) {
    				waypoint_changes.$$scope = { dirty, ctx };
    			}

    			waypoint.$set(waypoint_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(waypoint.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(waypoint.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(waypoint, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Image', slots, []);
    	let { c = "" } = $$props;
    	let { alt = "" } = $$props;
    	let { width = null } = $$props;
    	let { height = null } = $$props;
    	let { src = "" } = $$props;
    	let { srcset = "" } = $$props;
    	let { srcsetWebp = "" } = $$props;
    	let { ratio = "100%" } = $$props;
    	let { blur = true } = $$props;
    	let { sizes = "(max-width: 1000px) 100vw, 1000px" } = $$props;
    	let { offset = 0 } = $$props;
    	let { threshold = 1.0 } = $$props;
    	let { lazy = true } = $$props;
    	let { wrapperClass = "" } = $$props;
    	let { placeholderClass = "" } = $$props;
    	let { blurhash = null } = $$props;
    	let { blurhashSize = null } = $$props;
    	let { class: className = "" } = $$props;
    	let loaded = !lazy;

    	function load(img) {
    		img.onload = () => $$invalidate(18, loaded = true);
    	}

    	function decodeBlurhash(canvas) {
    		const pixels = decode$1(blurhash, blurhashSize.width, blurhashSize.height);
    		const ctx = canvas.getContext('2d');
    		const imageData = ctx.createImageData(blurhashSize.width, blurhashSize.height);
    		imageData.data.set(pixels);
    		ctx.putImageData(imageData, 0, 0);
    	}

    	const writable_props = [
    		'c',
    		'alt',
    		'width',
    		'height',
    		'src',
    		'srcset',
    		'srcsetWebp',
    		'ratio',
    		'blur',
    		'sizes',
    		'offset',
    		'threshold',
    		'lazy',
    		'wrapperClass',
    		'placeholderClass',
    		'blurhash',
    		'blurhashSize',
    		'class'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Image> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('c' in $$props) $$invalidate(0, c = $$props.c);
    		if ('alt' in $$props) $$invalidate(1, alt = $$props.alt);
    		if ('width' in $$props) $$invalidate(2, width = $$props.width);
    		if ('height' in $$props) $$invalidate(3, height = $$props.height);
    		if ('src' in $$props) $$invalidate(4, src = $$props.src);
    		if ('srcset' in $$props) $$invalidate(5, srcset = $$props.srcset);
    		if ('srcsetWebp' in $$props) $$invalidate(6, srcsetWebp = $$props.srcsetWebp);
    		if ('ratio' in $$props) $$invalidate(7, ratio = $$props.ratio);
    		if ('blur' in $$props) $$invalidate(8, blur = $$props.blur);
    		if ('sizes' in $$props) $$invalidate(9, sizes = $$props.sizes);
    		if ('offset' in $$props) $$invalidate(10, offset = $$props.offset);
    		if ('threshold' in $$props) $$invalidate(11, threshold = $$props.threshold);
    		if ('lazy' in $$props) $$invalidate(12, lazy = $$props.lazy);
    		if ('wrapperClass' in $$props) $$invalidate(13, wrapperClass = $$props.wrapperClass);
    		if ('placeholderClass' in $$props) $$invalidate(14, placeholderClass = $$props.placeholderClass);
    		if ('blurhash' in $$props) $$invalidate(15, blurhash = $$props.blurhash);
    		if ('blurhashSize' in $$props) $$invalidate(16, blurhashSize = $$props.blurhashSize);
    		if ('class' in $$props) $$invalidate(17, className = $$props.class);
    	};

    	$$self.$capture_state = () => ({
    		decode: decode$1,
    		Waypoint,
    		c,
    		alt,
    		width,
    		height,
    		src,
    		srcset,
    		srcsetWebp,
    		ratio,
    		blur,
    		sizes,
    		offset,
    		threshold,
    		lazy,
    		wrapperClass,
    		placeholderClass,
    		blurhash,
    		blurhashSize,
    		className,
    		loaded,
    		load,
    		decodeBlurhash
    	});

    	$$self.$inject_state = $$props => {
    		if ('c' in $$props) $$invalidate(0, c = $$props.c);
    		if ('alt' in $$props) $$invalidate(1, alt = $$props.alt);
    		if ('width' in $$props) $$invalidate(2, width = $$props.width);
    		if ('height' in $$props) $$invalidate(3, height = $$props.height);
    		if ('src' in $$props) $$invalidate(4, src = $$props.src);
    		if ('srcset' in $$props) $$invalidate(5, srcset = $$props.srcset);
    		if ('srcsetWebp' in $$props) $$invalidate(6, srcsetWebp = $$props.srcsetWebp);
    		if ('ratio' in $$props) $$invalidate(7, ratio = $$props.ratio);
    		if ('blur' in $$props) $$invalidate(8, blur = $$props.blur);
    		if ('sizes' in $$props) $$invalidate(9, sizes = $$props.sizes);
    		if ('offset' in $$props) $$invalidate(10, offset = $$props.offset);
    		if ('threshold' in $$props) $$invalidate(11, threshold = $$props.threshold);
    		if ('lazy' in $$props) $$invalidate(12, lazy = $$props.lazy);
    		if ('wrapperClass' in $$props) $$invalidate(13, wrapperClass = $$props.wrapperClass);
    		if ('placeholderClass' in $$props) $$invalidate(14, placeholderClass = $$props.placeholderClass);
    		if ('blurhash' in $$props) $$invalidate(15, blurhash = $$props.blurhash);
    		if ('blurhashSize' in $$props) $$invalidate(16, blurhashSize = $$props.blurhashSize);
    		if ('className' in $$props) $$invalidate(17, className = $$props.className);
    		if ('loaded' in $$props) $$invalidate(18, loaded = $$props.loaded);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		c,
    		alt,
    		width,
    		height,
    		src,
    		srcset,
    		srcsetWebp,
    		ratio,
    		blur,
    		sizes,
    		offset,
    		threshold,
    		lazy,
    		wrapperClass,
    		placeholderClass,
    		blurhash,
    		blurhashSize,
    		className,
    		loaded,
    		load,
    		decodeBlurhash
    	];
    }

    class Image extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			c: 0,
    			alt: 1,
    			width: 2,
    			height: 3,
    			src: 4,
    			srcset: 5,
    			srcsetWebp: 6,
    			ratio: 7,
    			blur: 8,
    			sizes: 9,
    			offset: 10,
    			threshold: 11,
    			lazy: 12,
    			wrapperClass: 13,
    			placeholderClass: 14,
    			blurhash: 15,
    			blurhashSize: 16,
    			class: 17
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Image",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get c() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set c(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get alt() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set alt(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get src() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set src(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get srcset() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set srcset(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get srcsetWebp() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set srcsetWebp(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ratio() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ratio(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get blur() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set blur(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sizes() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sizes(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get offset() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set offset(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get threshold() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set threshold(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lazy() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lazy(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get wrapperClass() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wrapperClass(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get placeholderClass() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholderClass(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get blurhash() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set blurhash(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get blurhashSize() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set blurhashSize(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.42.4 */
    const file = "src\\App.svelte";

    // (8:0) <PageCentered>
    function create_default_slot(ctx) {
    	let div0;
    	let t1;
    	let div1;
    	let image;
    	let t2;
    	let counter;
    	let t3;
    	let h3;
    	let current;
    	let mounted;
    	let dispose;

    	image = new Image({
    			props: {
    				src: "data:image/png;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAArAEADASIAAhEBAxEB/8QAGQAAAwEBAQAAAAAAAAAAAAAABQYHBAgC/8QAMBAAAgEDAwIDBwUAAwAAAAAAAQIDBAURAAYhEjETIkEHFDJRcYGRFSNCYcGhsfD/xAAZAQEAAwEBAAAAAAAAAAAAAAAFAQIDBAD/xAAiEQACAwABAwUBAAAAAAAAAAABAgADESEEEiIxMlFSscH/2gAMAwEAAhEDEQA/AFC3bNWqkDN5Is8sBz9Bp0t207NSw80SykDzNJydFKOKNIVjUEgcDA9daUp5qmSKKgBeVz5UPdj6a2SlEEwa52PEH1mzaL3cT01MaaTGfEp2KlPrpDvtZuW1N0pfri9NnCsJyNXqtD2mwxzXsLTSCLLjqHlcfJuxzqcLtm5X2SeqovBWWWFgIjKrhkI6lcAHuMEdvl6aOtYEduc/I/sSqBHlvHwYjU+/d4+7Gniv1ayHgcgn84zolt+2bmvThp73diH5Kx1D5+pOcDTHTbKuBs4lqJIIqNZy3QoERl6U+HLEd2I+eOTqhWK3y2nbVQZ6N6eSJJHCsvSG6RkHq/ln56rUPtp/Je0jPHB+ybpsq1zyyRXF6uaoU9JkedmJP10ubm9mhWCR7LVyl1593lb4vodOlsrnkpw80h8U56iRxzohl4xGWdXJ7444Ok26asjCIavVWA6DB8EvhQLlsO58xI7DPP30xbVuMS3uZqaNTN0FY8H1HBx9tKEKdbM7sCqrhfNwDoQ08tmv9tqvEPQlQC/PoccH7Y/Or2LqkTGs4wMqe4Irndto3eW+01LTxovi0tLMxckoc/uY4AODwM4B1j2Nte3TWiS4PWVdBLLH1Qx09QzwxODkOgzzggHH20v7n3s8NXDeK83Cqij60prfS05jXqPxeI5HoB21cdqrBV2Ggmg4jkgSRSFCnkA9vQ86MVNPMUazPSSa1Wu5x0VPcdwXef3+CfBpVVkQxqxKYB9WOWPpzg5xnT7Tbl/U/DoKujd4qlTlseUrjnIOs2/rNdKqmaohqjTU1MjylYk63JAPYeueNNdjt8dPbaNJFHjJCgY5zzgZ/wCdSidvpIssDcmc+3Zf07cFXQqreHHKUyewH8T/AJrdBOXTHUxYHPVjOf60N3pOJN/XtugBEn6c4x6D868U8xUh2Cg5wSB+NLKdUEwojGOTwk8ccQQENx0nHpzyf+9DLpMk9K7jq5PX37HGf8Gs87t0znqORwPxoZXyN7pKQxBAU8fXUCeMNWTe92rK6K12qnqKq4NCyQhiDDACTzj/AE866P2xGu2do00NdUGQ0sOZZX7se5P5OucPZRK8Hv1VEemdRkPjOMf121TvaFcKqT2cxSvMxkd06jgDOuCxexjk70JdRscrt7RtvW+NXuVaKaFjjxXHlU/3jtpL9p2/7hti4Wu/2OGGvstV0JUOrZ6kzx0nt6nnShuP9mKyNGApl6S+APMSOc/PSFvG7VlR+s22WRGoKVUkgg8JAsbE9144Osg+nDNigA0QnV3g3a8VlwQgtVSM4AH44+gOiK1geCNurBTCsByT8j/756QttEm3MSSSCSDn1zo74jGGTzH4+n7YOll9vEJb3Gf/2Q==",
    				srcset: "g/images/kitty-400.jpg 375w,g/images/kitty-800.jpg 768w,g/images/kitty-1200.jpg 1024w",
    				ratio: "66.6796875%",
    				srcsetWebp: "g/images/kitty-400.webp 375w,g/images/kitty-800.webp 768w,g/images/kitty-1200.webp 1024w",
    				alt: "kitty"
    			},
    			$$inline: true
    		});

    	counter = new Counter({ $$inline: true });

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			div0.textContent = "Hello World";
    			t1 = space();
    			div1 = element("div");
    			create_component(image.$$.fragment);
    			t2 = space();
    			create_component(counter.$$.fragment);
    			t3 = space();
    			h3 = element("h3");
    			h3.textContent = "The End";
    			attr_dev(div0, "class", "title");
    			attr_dev(div0, "title", "From Svelte");
    			add_location(div0, file, 8, 2, 270);
    			attr_dev(div1, "class", "imgContainer svelte-15pd1w1");
    			add_location(div1, file, 9, 2, 341);
    			attr_dev(h3, "title", "From Svelte");
    			attr_dev(h3, "class", "svelte-15pd1w1");
    			add_location(h3, file, 14, 2, 2567);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			mount_component(image, div1, null);
    			insert_dev(target, t2, anchor);
    			mount_component(counter, target, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, h3, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = action_destroyer(tooltip.call(null, div0));
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(image.$$.fragment, local);
    			transition_in(counter.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(image.$$.fragment, local);
    			transition_out(counter.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			destroy_component(image);
    			if (detaching) detach_dev(t2);
    			destroy_component(counter, detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(h3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(8:0) <PageCentered>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let pagecentered;
    	let current;

    	pagecentered = new PageCentered({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(pagecentered.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(pagecentered, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const pagecentered_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				pagecentered_changes.$$scope = { dirty, ctx };
    			}

    			pagecentered.$set(pagecentered_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(pagecentered.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(pagecentered.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(pagecentered, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ PageCentered, Counter, tooltip, Image });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      props: {},
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
