/* eslint-disable no-console, no-underscore-dangle */
/* globals window */
import { Subject } from 'rxjs';
import _ from 'lodash';

import createStore from './createStore';
import Provider from './components/Provider';
import h from './h';

class BaseApp {
  constructor(opts = {}) {
    this.options = {
      // primary info
      name: null,
      devSessionId: null,
      rootApp: null,
      version: 1,

      // the root component to render
      component: null,

      // list of Model instances
      models: {},

      // store
      store: null,
      reducer: (state = {}) => state,
      initialState: {},
      enableLogger: true,

      services: {},
      factories: {},

      // lifecycle callbacks
      beforeMount: () => {},
      afterMount: () => {},
      beforeUnmount: () => {},

      // override
      ...opts
    };

    // errors
    if (!this.options.name) {
      throw new Error('Must provide `name` in options');
    }

    if (!this.options.component) {
      throw new Error('Must provide `component` in options');
    }

    // widgets
    this.widgetsByRegion = {};

    if (
      typeof window !== 'undefined' &&
      typeof window.app !== 'undefined'
    ) {
      this.options.rootApp = window.app;
    }

    this.widgetsSubject$ = new Subject();

    // store
    this._createStore(
      this.options.reducer,
      this.options.initialState
    );

    this.readableApps = [];
  }

  getRootApp() {
    return this.options.rootApp;
  }

  getModel(modelName) { // eslint-disable-line
    // will be implemented below when extended
  }

  getService(serviceName) { // eslint-disable-line
    // will be implemented below when extended
  }

  getFactory(factoryName) {
    // TODO: optimize code to be more DRY
    const factories = this.getOption('factories');
    const FactoryClass = factories[factoryName];

    if (FactoryClass) {
      return new FactoryClass({
        app: this
      });
    }

    const rootApp = this.getRootApp();

    if (!rootApp) {
      return null;
    }

    const rootFactories = rootApp.getOption('factories');
    const RootFactoryClass = rootFactories[factoryName];

    if (RootFactoryClass) {
      return new RootFactoryClass({
        app: this
      });
    }

    return null;
  }

  createStore(rootReducer, initialState = {}) {
    console.warn('[DEPRECATED] `createStore` has been deprecated.');

    return this._createStore(rootReducer, initialState);
  }

  _createStore(rootReducer, initialState = {}) {
    const Store = createStore({
      reducer: rootReducer,
      initialState,
      enableLogger: this.options.enableLogger,
      thunkArgument: { app: this },
      appendAction: {
        appName: this.options.name,
      },
    });
    this.options.store = new Store();

    return this.options.store;
  }

  getStore(appName = null) {
    console.warn('[DEPRECATED] `getStore` has been deprecated, use `getState$` instead.');

    return this._getStore(appName);
  }

  _getAppByName(appName = null) {
    if (!appName) {
      return this;
    }

    const rootApp = this.getRootApp();
    const widgetsByRegion = rootApp
      ? rootApp.widgetsByRegion
      : this.widgetsByRegion;

    const appsByName = _.reduce(widgetsByRegion, (result, value) => {
      value.forEach((app) => {
        const name = app.getOption('name');
        result[name] = app;
      });

      return result;
    }, {});

    // @TODO: check for permissions
    if (typeof appsByName[appName] !== 'undefined') {
      return appsByName[appName];
    }

    return null;
  }

  _getStore(appName = null) {
    const app = this._getAppByName(appName);

    if (!app) {
      return null;
    }

    return app.getOption('store');
  }

  getState$(appName = null) {
    const app = this._getAppByName(appName);

    if (!app) {
      return null;
    }

    return app.options.store.getState$();
  }

  dispatch(action) {
    return this._getStore().dispatch(action);
  }

  getOption(key) {
    return this.options[key];
  }

  registerWidget(widgetApp, regionName) {
    if (!Array.isArray(this.widgetsByRegion[regionName])) {
      this.widgetsByRegion[regionName] = [];
    }

    this.widgetsByRegion[regionName].push(widgetApp);

    return this.widgetsSubject$.next(this.widgetsByRegion);
  }

  beforeMount() {
    return this.options.beforeMount.bind(this)();
  }

  /**
   *
   * @param {Object} [componentProps=null]
   * @return {Function<Object>}
   */
  render(componentProps = null) {
    const Component = this.getOption('component');
    const self = this;

    return () => (
      <Provider app={self}>
        <Component {...componentProps} />
      </Provider>
    );
  }

  afterMount() {
    return this.options.afterMount.bind(this)();
  }

  beforeUnmount() {
    const output = this.options.beforeUnmount.bind(this)();
    this.options.store.destroy();

    return output;
  }

  /**
   * Alternative to Core.registerWidget(),
   * by doing Widget.setRegion()
   */
  setRegion(regionName) {
    return this.setRegions([regionName]);
  }

  setRegions(regionNames) {
    const rootApp = this.getRootApp();

    if (!rootApp) {
      throw new Error('No root app instance available, so cannot set region.');
    }

    return regionNames.forEach((regionName) => {
      return rootApp.registerWidget(this, regionName);
    });
  }

  getWidgets(regionName = null) {
    if (!regionName) {
      return this.widgetsByRegion;
    }

    const list = this.widgetsByRegion[regionName];

    if (!list) {
      return [];
    }

    return list;
  }

  observeWidgets() {
    console.warn('[DEPRECATED] `observeWidgets` is deprecated, use `observeWidgets$` instead.');

    return this.observeWidgets$();
  }

  observeWidgets$() {
    return this.widgetsSubject$.startWith(
      this.getWidgets()
    );
  }

  readStateFrom(appNames = []) {
    this.readableApps = appNames;
  }
}

export default function createApp(options = {}) {
  const modelRegistry = {};
  const serviceInstances = {};

  class App extends BaseApp {
    constructor(opts = {}) {
      super(_.merge(
        options,
        opts
      ));

      // models
      _.each(this.options.models, (ModelClass, modelName) => {
        if (typeof ModelClass !== 'function') {
          throw new Error(`Expected model class '${modelName}' to be a valid Model class`);
        }

        modelRegistry[modelName] = _.memoize(() => {
          const attrs = this.options.modelAttributes[modelName] || {};
          return new ModelClass(attrs);
        }, () => modelName);
      });

      // services
      _.each(this.options.services, (ServiceClass, serviceName) => {
        serviceInstances[serviceName] = new ServiceClass({
          app: this
        });
      });
    }

    getModel(modelName) {
      if (modelName in modelRegistry) {
        return modelRegistry[modelName]();
      }
      const rootApp = this.getRootApp();
      if (rootApp) {
        return rootApp.getModel(modelName);
      }
      return null;
    }

    getService(serviceName) {
      if (serviceInstances[serviceName]) {
        return serviceInstances[serviceName];
      }

      const rootApp = this.getRootApp();

      if (!rootApp) {
        return null;
      }

      const serviceFromRoot = rootApp.getService(serviceName);

      if (serviceFromRoot) {
        return serviceFromRoot;
      }

      return null;
    }
  }

  return App;
}
