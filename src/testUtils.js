import react from 'react';

import { selectors } from 'data/redux';

import * as appHooks from 'hooks';

import { StrictDict } from 'utils';

const { cardData } = selectors;

/**
 * Mocked formatMessage provided by react-intl
 */
export const formatMessage = (msg, values) => {
  let message = msg.defaultMessage;
  if (values === undefined) {
    return message;
  }
  Object.keys(values).forEach((key) => {
    // eslint-disable-next-line
    message = message.replace(`{${key}}`, values[key]);
  });
  return message;
};

/**
 * Mock a single component, or a nested component so that its children render nicely
 * in snapshots.
 * @param {string} name - parent component name
 * @param {obj} contents - object of child components with intended component
 *   render name.
 * @return {func} - mock component with nested children.
 *
 * usage:
 *   mockNestedComponent('Card', { Body: 'Card.Body', Form: { Control: { Feedback: 'Form.Control.Feedback' }}... });
 *   mockNestedComponent('IconButton', 'IconButton');
 */
export const mockNestedComponent = (name, contents) => {
  if (typeof contents !== 'object') {
    return contents;
  }
  const fn = () => name;
  Object.defineProperty(fn, 'name', { value: name });
  Object.keys(contents).forEach((nestedName) => {
    const value = contents[nestedName];
    fn[nestedName] = typeof value !== 'object'
      ? value
      : mockNestedComponent(`${name}.${nestedName}`, value);
  });
  return fn;
};

/**
 * Mock a module of components.  nested components will be rendered nicely in snapshots.
 * @param {obj} mapping - component module mock config.
 * @return {obj} - module of flat and nested components that will render nicely in snapshots.
 * usage:
 *   mockNestedComponents({
 *     Card: { Body: 'Card.Body' },
 *     IconButton: 'IconButton',
 *   })
 */
export const mockNestedComponents = (mapping) => Object.entries(mapping).reduce(
  (obj, [name, value]) => ({
    ...obj,
    [name]: mockNestedComponent(name, value),
  }),
  {},
);

/**
 * Mock utility for working with useState in a hooks module.
 * Expects/requires an object containing the state object in order to ensure
 * the mock behavior works appropriately.
 *
 * Expected format:
 *   hooks = { state: { <key>: (val) => React.createRef(val), ... } }
 *
 * Returns a utility for mocking useState and providing access to specific state values
 * and setState methods, as well as allowing per-test configuration of useState value returns.
 *
 * Example usage:
 *   // hooks.js
 *   import * as module from './hooks';
 *   const state = {
 *     isOpen: (val) => React.useState(val),
 *     hasDoors: (val) => React.useState(val),
 *     selected: (val) => React.useState(val),
 *   };
 *   ...
 *   export const exampleHook = () => {
 *     const [isOpen, setIsOpen] = module.state.isOpen(false);
 *     if (!isOpen) { return null; }
 *     return { isOpen, setIsOpen };
 *   }
 *   ...
 *
 *   // hooks.test.js
 *   import * as hooks from './hooks';
 *   const state = new MockUseState(hooks)
 *   ...
 *   describe('state hooks', () => {
 *     state.testGetter(state.keys.isOpen);
 *     state.testGetter(state.keys.hasDoors);
 *     state.testGetter(state.keys.selected);
 *   });
 *   describe('exampleHook', () => {
 *     beforeEach(() => { state.mock(); });
 *     it('returns null if isOpen is default value', () => {
 *       expect(hooks.exampleHook()).toEqual(null);
 *     });
 *     it('returns isOpen and setIsOpen if isOpen is not null', () => {
 *       state.mockVal(state.keys.isOpen, true);
 *       expect(hooks.exampleHook()).toEqual({
 *         isOpen: true,
 *         setIsOpen: state.setState[state.keys.isOpen],
 *       });
 *     });
 *     afterEach(() => { state.restore(); });
 *   });
 *
 * @param {obj} hooks - hooks module containing a 'state' object
 */
export class MockUseState {
  constructor(hooks) {
    this.hooks = hooks;
    this.oldState = null;
    this.setState = {};
    this.stateVals = {};

    this.mock = this.mock.bind(this);
    this.restore = this.restore.bind(this);
    this.mockVal = this.mockVal.bind(this);
    this.testGetter = this.testGetter.bind(this);
  }

  /**
   * @return {object} - StrictDict of state object keys
   */
  get keys() {
    return StrictDict(Object.keys(this.hooks.state).reduce(
      (obj, key) => ({ ...obj, [key]: key }),
      {},
    ));
  }

  /**
   * Replace the hook module's state object with a mocked version, initialized to default values.
   */
  mock() {
    this.oldState = this.hooks.state;
    Object.keys(this.keys).forEach(key => {
      this.hooks.state[key] = jest.fn(val => {
        this.stateVals[key] = val;
        return [val, this.setState[key]];
      });
    });
    this.setState = Object.keys(this.keys).reduce(
      (obj, key) => ({
        ...obj,
        [key]: jest.fn(val => {
          this.hooks.state[key] = val;
        }),
      }),
      {},
    );
  }

  expectInitializedWith(key, value) {
    expect(this.hooks.state[key]).toHaveBeenCalledWith(value);
  }

  /**
   * Restore the hook module's state object to the actual code.
   */
  restore() {
    this.hooks.state = this.oldState;
  }

  /**
   * Mock the state getter associated with a single key to return a specific value one time.
   * @param {string} key - state key (from this.keys)
   * @param {any} val - new value to be returned by the useState call.
   */
  mockVal(key, val) {
    this.hooks.state[key].mockReturnValueOnce([val, this.setState[key]]);
  }

  testGetter(key) {
    test(`${key} state getter should return useState passthrough`, () => {
      const testValue = 'some value';
      const useState = (val) => ({ useState: val });
      jest.spyOn(react, 'useState').mockImplementationOnce(useState);
      expect(this.hooks.state[key](testValue)).toEqual(useState(testValue));
    });
  }
}

/**
 * Test that useCardValues was called with the given courseNumber and selector mapping.
 * @param {string} courseNumber - course run identifier
 * @param {obj} mapping - value mapping { <requestedKey>: <selectorFieldKey> }
 */
export const testCardValues = (courseNumber, mapping) => {
  describe('cardData values', () => {
    let mapped;
    test('passess correct courseNumber', () => {
      expect(appHooks.useCardValues.mock.calls[0][0]).toEqual(courseNumber);
    });
    Object.keys(mapping).forEach(key => {
      test(`loads ${key} from card data ${mapping[key]} selector`, () => {
        [[, mapped]] = appHooks.useCardValues.mock.calls;
        expect(mapped[key]).toEqual(cardData[mapping[key]]);
      });
    });
  });
};
