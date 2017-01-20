/* eslint-disable no-console, no-underscore-dangle */
/* globals window */
import _ from 'lodash';
import React, { PropTypes } from 'react';

import h from '../h';

// @TODO: check for an alternative to remove global dependency
function getWidgets(name) {
  return window.app.getWidgets(name);
}

function getObservable$(name) {
  return window.app.observeWidgets$(name);
}

function isRootAppAvailable() {
  return (
    typeof window !== 'undefined' &&
    window.app
  );
}

export default React.createClass({
  propTypes: {
    name: PropTypes.string.isRequired
  },

  /**
   * Determines if the the component should be updated or not.
   * Since we are calling setState multiple times, we need to make sure that only when
   * the list of widgets to render, i.e. this.state.listForRendering, is changed should
   * trigger a re-render of the region component.
   * @param  {Object}  nextProps  the next set of props
   * @param  {Object}  nextState  the next component state to be set
   * @return {Boolean} a boolean flag indicating whether the component should be updated
   */
  shouldComponentUpdate(nextProps, nextState) {
    let shouldUpdate = !_.isEqual(this.props, nextProps);
    if (!shouldUpdate) {
      const { listForRendering } = nextState;
      shouldUpdate = shouldUpdate || this.state.listForRendering.length !== listForRendering.length;
      shouldUpdate = shouldUpdate ||
        _.zipWith(this.state.listForRendering, listForRendering, (prev, next) => prev.name === next.name)
          .some(value => !value);
    }
    return shouldUpdate;
  },

  componentWillMount() {
    if (!isRootAppAvailable()) {
      return;
    }

    const observable = getObservable$();

    this.subscription = observable.subscribe({
      // @TODO: this can be optimized further
      next: () => {
        this.setState({
          list: getWidgets(this.props.name)
        }, () => {
          this.state.list.forEach((widget) => {
            const appName = widget.getOption('appName');
            const widgetName = widget.getOption('name');

            const existsInState = this.state.listForRendering.some((item) => {
              return (item.appName === appName) && (item.name === widgetName);
            });

            if (existsInState) {
              return;
            }

            const WidgetComponent = widget.render();
            const WrapperComponent = React.createClass({
              componentWillMount() {
                widget.beforeMount();
              },

              componentDidMount() {
                widget.afterMount();
              },

              componentWillUnmount() {
                widget.beforeUnmount();
              },

              render() {
                return <WidgetComponent />;
              }
            });

            const listForRendering = [...this.state.listForRendering, {
              appName,
              Component: WrapperComponent,
              name: widgetName,
            }];

            this.setState({ listForRendering });
          });
        });
      },
      error: (err) => {
        console.warn(`Subscription error for <Region name="${this.props.name}" />:`, err);
      }
    });
  },

  componentWillUnmount() {
    this.subscription.unsubscribe();
  },

  getInitialState() {
    return {
      list: [], // array of widgetApps
      listForRendering: [] // array of {name, component} objects
    };
  },

  render() {
    const { listForRendering } = this.state;

    if (listForRendering.length === 0) {
      return null;
    }

    return (
      <div>
        {listForRendering.map((item) => {
          const { appName, Component, name } = item;

          return (
            <Component key={`${appName}_${name}`} />
          );
        })}
      </div>
    );
  }
});
