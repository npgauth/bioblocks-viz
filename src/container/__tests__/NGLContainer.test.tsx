import { mount, shallow } from 'enzyme';
import * as React from 'react';
import { Provider } from 'react-redux';

import { Checkbox, Icon, Menu, Popup, Table } from 'semantic-ui-react';
import { NGLContainer, NGLContainerClass } from '~bioblocks-viz~/container';
import { BioblocksPDB } from '~bioblocks-viz~/data';
import { BBStore } from '~bioblocks-viz~/reducer';

describe('NGLContainer', () => {
  it('Should match the default snapshot when hooked up to a redux store.', () => {
    const store = BBStore;
    const wrapper = mount(
      <Provider store={store}>
        <NGLContainer />
      </Provider>,
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('Should match the default snapshot when not hooked up to a redux store.', () => {
    const wrapper = shallow(<NGLContainerClass />);
    expect(wrapper).toMatchSnapshot();
  });

  it('Should handle experimental PDB files.', async () => {
    const pdbs = await Promise.all([
      BioblocksPDB.createPDB('exp_1_sample.pdb'),
      BioblocksPDB.createPDB('exp_2_sample.pdb'),
    ]);

    const wrapper = shallow(<NGLContainerClass experimentalProteins={pdbs} />);

    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: ['exp_1_sample'],
      selectedPredictedProteins: [],
    });
    wrapper.setProps({
      experimentalProteins: [pdbs[1]],
    });
    wrapper.update();
    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: ['exp_2_sample'],
      selectedPredictedProteins: [],
    });
  });

  it('Should handle predicted PDB files.', async () => {
    const pdbs = await Promise.all([
      BioblocksPDB.createPDB('pred_1_sample.pdb'),
      BioblocksPDB.createPDB('pred_2_sample.pdb'),
    ]);

    const wrapper = shallow(<NGLContainerClass predictedProteins={pdbs} />);

    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: [],
      selectedPredictedProteins: ['pred_1_sample'],
    });
    wrapper.setProps({
      predictedProteins: [pdbs[1]],
    });
    wrapper.update();
    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: [],
      selectedPredictedProteins: ['pred_2_sample'],
    });
  });

  it('Should handle selecting PDB files via checkbox.', async () => {
    const pdbs = await Promise.all([
      BioblocksPDB.createPDB('exp_1_sample.pdb'),
      BioblocksPDB.createPDB('exp_2_sample.pdb'),
      BioblocksPDB.createPDB('pred_1_sample.pdb'),
      BioblocksPDB.createPDB('pred_2_sample.pdb'),
    ]);

    const wrapper = mount(
      <NGLContainerClass experimentalProteins={[pdbs[0], pdbs[1]]} predictedProteins={[pdbs[2], pdbs[3]]} />,
    );

    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: ['exp_1_sample'],
      selectedPredictedProteins: ['pred_1_sample'],
    });

    wrapper
      .find(Popup)
      .at(0)
      .simulate('click');
    wrapper
      .find(Checkbox)
      .at(1)
      .simulate('change');
    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: ['exp_1_sample', 'exp_2_sample'],
      selectedPredictedProteins: ['pred_1_sample'],
    });
    wrapper
      .find(Checkbox)
      .at(0)
      .simulate('change');
    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: ['exp_2_sample'],
      selectedPredictedProteins: ['pred_1_sample'],
    });

    wrapper
      .find(Menu.Item)
      .at(1)
      .simulate('click');
    wrapper
      .find(Checkbox)
      .at(3)
      .simulate('change');
    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: ['exp_2_sample'],
      selectedPredictedProteins: ['pred_1_sample', 'pred_2_sample'],
    });
    wrapper
      .find(Checkbox)
      .at(2)
      .simulate('change');
    expect(wrapper.instance().state).toEqual({
      selectedExperimentalProteins: ['exp_2_sample'],
      selectedPredictedProteins: ['pred_2_sample'],
    });
  });

  it('Should not show a popup when there are no PDB files to select.', async () => {
    const wrapper = mount(<NGLContainerClass />);

    wrapper
      .find(Icon)
      .at(0)
      .simulate('click');
    expect(wrapper.find(Checkbox).length).toBe(0);

    const pdbs = await Promise.all([
      BioblocksPDB.createPDB('exp_1_sample.pdb'),
      BioblocksPDB.createPDB('exp_2_sample.pdb'),
    ]);

    wrapper.setProps({ experimentalProteins: pdbs, predictedProteins: pdbs });
    wrapper
      .find(Popup)
      .at(0)
      .simulate('click');
    expect(wrapper.find(Checkbox).length).not.toBe(0);

    wrapper
      .find(Menu.Item)
      .at(1)
      .simulate('click');
    expect(wrapper.find(Checkbox).length).not.toBe(0);
  });

  it('Should handle clearing PDB files.', async () => {
    const pdbs = await Promise.all([
      BioblocksPDB.createPDB('pred_1_sample.pdb'),
      BioblocksPDB.createPDB('pred_2_sample.pdb'),
    ]);

    const wrapper = mount(<NGLContainerClass experimentalProteins={pdbs} predictedProteins={pdbs} />);
    const instance = wrapper.instance() as NGLContainerClass;
    wrapper
      .find(Icon)
      .at(0)
      .simulate('click');
    expect(instance.state.selectedExperimentalProteins).toEqual(['pred_1_sample']);
    expect(instance.state.selectedPredictedProteins).toEqual(['pred_1_sample']);

    wrapper.setProps({
      experimentalProteins: [],
      predictedProteins: [],
    });
    wrapper.update();
    expect(instance.state.selectedExperimentalProteins).toEqual([]);
    expect(instance.state.selectedPredictedProteins).toEqual([]);
  });

  it('Should show the correct sequence match.', async () => {
    let experimentalPDB = await BioblocksPDB.createPDB('exp_1_sample');
    let predictedPDB = await BioblocksPDB.createPDB('pred_1_sample');

    Object.defineProperty(experimentalPDB, 'sequence', { value: 'ABCDEFGHIJ' });
    Object.defineProperty(predictedPDB, 'sequence', { value: 'ABCDEFGHIJ' });

    const wrapper = mount(
      <NGLContainerClass experimentalProteins={[experimentalPDB]} predictedProteins={[predictedPDB]} />,
    );

    wrapper
      .find(Icon)
      .at(0)
      .simulate('click');
    expect(
      wrapper
        .find(Table.Cell)
        .at(4)
        .text(),
    ).toEqual('100.0%');

    experimentalPDB = await BioblocksPDB.createPDB('exp_2_sample');
    predictedPDB = await BioblocksPDB.createPDB('pred_2_sample');

    Object.defineProperty(experimentalPDB, 'sequence', { value: 'BCDEFFGHIJ' });
    Object.defineProperty(predictedPDB, 'sequence', { value: 'ABCDEFGHIJ' });

    wrapper.setProps({
      experimentalProteins: [experimentalPDB],
      predictedProteins: [predictedPDB],
    });

    expect(
      wrapper
        .find(Table.Cell)
        .at(4)
        .text(),
    ).toEqual('50.0%');
  });
});
