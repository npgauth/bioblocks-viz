import { createSpringReducer, ReducerRegistry, SpringReducer } from '~chell-viz~/reducer';

describe('SpringReducer', () => {
  it('Should handle undefined state.', () => {
    const expectedState = {
      category: null,
      graphData: null,
      species: null,
    };
    const reducer = SpringReducer();
    expect(reducer(undefined, { type: 'load' })).toMatchObject(expectedState);
  });

  it('Should allow creating a namespaced spring reducer.', () => {
    expect(ReducerRegistry.getReducers()).not.toHaveProperty('nirvana/spring');
    createSpringReducer('nirvana');
    expect(ReducerRegistry.getReducers()).toHaveProperty('nirvana/spring');
  });
});
