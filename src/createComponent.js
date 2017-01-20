import React from 'react';
import ReactDOM from 'react-dom';

/**
 * Module that specifies the createComponent function for creating Components.
 *
 * @module src/createComponent.js
 */

/**
 * Creates a component to be used in the application.
 *
 * @function createComponent
 * @param {Object} options Specify the options to be used in this component,
 * the supported members are the render method, and lifecycle event handlers.
 * @return {ReactClass} The created component object.
 * @public
 */
export default function createComponent(options = {}) {
  if (!options.render || typeof options.render !== 'function') {
    throw new Error(`Component ${options.name} missing required method: render`);
  }

  return React.createClass({
    ...options,

    componentDidMount() {
      if (typeof options.afterMount === 'function') {
        return options.afterMount.call(this);
      }

      return null;
    },

    componentWillUnmount() {
      if (typeof options.beforeUnmount === 'function') {
        options.beforeUnmount.call(this);
      }
    },

    /**
     * Returns the root HTML element of the component.
     *
     * @method getDOMElement
     * @return {HTMLElement|null} Returns the component's root HTML Node.
     * @public
     */
    getDOMElement() {
      return ReactDOM.findDOMNode(this);
    },
  });
}
