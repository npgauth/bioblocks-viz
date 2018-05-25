import * as Plotly from 'plotly.js';
import * as React from 'react';

import ResidueContext, { initialResidueContext, IResidueSelection } from '../context/ResidueContext';
import { IContactMapData, ICouplingScore, RESIDUE_TYPE } from '../data/chell-data';
import { withDefaultProps } from '../helper/ReactHelper';
import ContactMapChart, { IContactMapChartData } from './chart/ContactMapChart';
import ChellSlider from './ChellSlider';

export type CONTACT_MAP_CB_RESULT_TYPE = ICouplingScore;
export type ContactMapCallback = (coupling: CONTACT_MAP_CB_RESULT_TYPE) => void;

export const defaultContactMapProps = {
  correctColor: '#ff0000',
  data: {
    couplingScores: [],
  } as IContactMapData,
  enableSliders: false,
  height: 400,
  highlightColor: '#ffff00',
  incorrectColor: '#000000',
  ...initialResidueContext,
  observedColor: '#0000ff',
  padding: 0,
  width: 400,
};

export const initialContactMapState = {
  chainLength: 59,
  correctPredictedContacts: [] as ICouplingScore[],
  linearDistFilter: 5,
  measuredContactDistFilter: 5,
  nodeSize: 3,
  numPredictionsToShow: 29,
  observedContacts: [] as ICouplingScore[],
  predictedContacts: [] as ICouplingScore[],
};

export type ContactMapProps = {} & typeof defaultContactMapProps;
export type ContactMapState = Readonly<typeof initialContactMapState>;

export class ContactMapClass extends React.Component<ContactMapProps, ContactMapState> {
  public readonly state: ContactMapState = initialContactMapState;

  constructor(props: ContactMapProps) {
    super(props);
  }

  public componentDidMount() {
    this.setupData(this.props.data);
  }

  public componentDidUpdate(prevProps: ContactMapProps, prevState: ContactMapState) {
    const { data } = this.props;

    const isFreshDataView =
      data !== prevProps.data ||
      this.state.linearDistFilter !== prevState.linearDistFilter ||
      this.state.numPredictionsToShow !== prevState.numPredictionsToShow ||
      this.state.chainLength !== prevState.chainLength;

    if (isFreshDataView) {
      this.setupData(data);
    }
  }

  public render() {
    const {
      correctColor,
      highlightColor,
      incorrectColor,
      observedColor,
      padding,
      width,
      addLockedResiduePair,
      addHoveredResidues,
      candidateResidues,
      hoveredResidues,
      lockedResiduePairs,
    } = this.props;

    const { chainLength, correctPredictedContacts, predictedContacts, nodeSize, observedContacts } = this.state;

    const sliderStyle = { width: width * 0.9 };

    const inputData = [
      {
        color: observedColor,
        name: 'Observed',
        points: observedContacts,
      },
      {
        color: incorrectColor,
        hoverinfo: 'x+y' as any,
        name: 'Incorrect Prediction',
        points: predictedContacts,
      },
      {
        color: correctColor,
        hoverinfo: 'x+y' as any,
        name: 'Correct Prediction',
        points: correctPredictedContacts,
      },
      {
        color: highlightColor,
        marker: {
          opacity: 0.5,
        },
        name: 'Selected Residue Pairs',
        points: lockedResiduePairs
          ? Object.keys(lockedResiduePairs as IResidueSelection)
              .filter(key => lockedResiduePairs[key].length === 2)
              .map(key => ({ i: lockedResiduePairs[key][0], j: lockedResiduePairs[key][1] }))
          : [],
      },
    ] as IContactMapChartData[];

    return (
      <div id="ContactMapComponent" style={{ padding }}>
        <ContactMapChart
          candidateResidues={candidateResidues}
          data={inputData}
          hoveredResidues={hoveredResidues}
          nodeSize={nodeSize}
          onClickCallback={this.onMouseClick(addLockedResiduePair)}
          onHoverCallback={this.onMouseEnter(addHoveredResidues)}
          onSelectedCallback={this.onMouseSelect()}
          range={[0, chainLength + 5]}
        />
        {this.props.enableSliders && this.renderSliders(sliderStyle, chainLength)}
      </div>
    );
  }

  protected renderSliders(sliderStyle: React.CSSProperties[] | React.CSSProperties, chainLength: number) {
    return (
      <div>
        <ChellSlider
          className={'node-size-slider'}
          defaultValue={initialContactMapState.nodeSize}
          label={'Node Size'}
          max={5}
          min={1}
          onChange={this.onNodeSizeChange()}
          style={sliderStyle}
        />
        <ChellSlider
          className={'linear-dist-filter'}
          defaultValue={initialContactMapState.linearDistFilter}
          label={'Linear Distance Filter (|i - j|)'}
          max={10}
          min={1}
          onChange={this.onLinearDistFilterChange()}
          style={sliderStyle}
        />
        <ChellSlider
          className={'predicted-contact-slider'}
          defaultValue={initialContactMapState.numPredictionsToShow}
          label={'Top N Predictions to Show'}
          max={59}
          min={1}
          onChange={this.onNumPredictionsToShowChange()}
          sliderProps={
            {
              /*marks: {
              1: 'One',
              [Math.floor(chainLength / 2)]: `Half (${Math.floor(chainLength / 2)})`,
              [chainLength]: `All (${chainLength})`,
            },*/
            }
          }
          style={sliderStyle}
        />
      </div>
    );
  }

  /**
   * Parse the incoming data object to determine which contacts to show and if they are correct/incorrect.
   *
   * @param data Incoming data object which has an array of all observed contacts.
   * @param contactViewType Whether to only show observed, predicted, or both kinds of contacts.
   */
  protected setupData(data: IContactMapData) {
    const chainLength = data.couplingScores.reduce((a, b) => Math.max(a, Math.max(b.i, b.j)), 0);

    const { linearDistFilter, measuredContactDistFilter, numPredictionsToShow } = this.state;

    const observedContacts = this.getObservedContacts(data.couplingScores, measuredContactDistFilter);
    const predictions = this.getPredictedContacts(data.couplingScores, numPredictionsToShow, linearDistFilter);

    this.setState({
      chainLength,
      correctPredictedContacts: predictions.correct,
      observedContacts,
      predictedContacts: predictions.predicted,
    });
  }

  protected onLinearDistFilterChange = () => (value: number) => {
    this.setState({
      linearDistFilter: value,
    });
  };

  protected onNodeSizeChange = () => (value: number) => {
    this.setState({
      nodeSize: value,
    });
  };

  protected onNumPredictionsToShowChange = () => (value: number) => {
    this.setState({
      numPredictionsToShow: value,
    });
  };

  protected onMouseEnter = (cb: (residue: RESIDUE_TYPE[]) => void) => (e: Plotly.PlotMouseEvent) => {
    const { points } = e;
    cb([points[0].x, points[0].y]);
  };

  protected onMouseClick = (cb: (residues: RESIDUE_TYPE[]) => void) => (e: Plotly.PlotMouseEvent) => {
    const { points } = e;
    cb([points[0].x, points[0].y]);
  };

  /**
   * Determine which contacts in a set of coupling scores are observed.
   *
   * @param contacts Set of contacts, usually generated from coupling_scores.csv.
   * @param [actualDistFilter=5] For each score, if dist <= linearDistFilter, it is considered observed.
   * @returns Contacts that should be considered observed int he current data set.
   */
  protected getObservedContacts(contacts: ICouplingScore[], actualDistFilter = 5): ICouplingScore[] {
    return contacts.filter(residuePair => residuePair.dist <= actualDistFilter);
  }

  /**
   * Determine which contacts in a set of coupling scores are predicted as well as which are correct.
   *
   * @param contacts Set of contacts, usually generated from coupling_scores.csv.
   * @param totalPredictionsToShow How many predictions, max, to return.
   * @param [linearDistFilter=5] For each score, if |i - j| >= linearDistFilter, it will be a candidate for being correct/incorrect.
   * @param [measuredContactDistFilter=5]  If the dist for the contact is less than predictionCutoffDist, it is considered correct.
   * @returns The list of correct and incorrect contacts.
   */
  protected getPredictedContacts(
    contacts: ICouplingScore[],
    totalPredictionsToShow: number,
    linearDistFilter = 5,
    measuredContactDistFilter = 5,
  ) {
    const result = {
      correct: new Array<ICouplingScore>(),
      predicted: new Array<ICouplingScore>(),
    };
    for (const contact of contacts
      .filter(score => Math.abs(score.i - score.j) >= linearDistFilter)
      .slice(0, totalPredictionsToShow)) {
      if (contact.dist < measuredContactDistFilter) {
        result.correct.push(contact);
      }
      result.predicted.push(contact);
    }
    return result;
  }

  protected onMouseSelect = () => (e: Plotly.PlotSelectionEvent) => {
    console.log(`onMouseSelect: ${e}`);
  };
}

export const ContactMapWithDefaultProps = withDefaultProps(defaultContactMapProps, ContactMapClass);

// TODO The required props should be discernable from `withDefaultProps` without needing to duplicate.
// However the Context consumer syntax is still new to me and I can't find the right combination :(
type requiredProps = Partial<typeof defaultContactMapProps> &
  Required<Omit<ContactMapProps, keyof typeof defaultContactMapProps>>;

const ContactMap = (props: requiredProps) => (
  <ResidueContext.Consumer>{context => <ContactMapWithDefaultProps {...props} {...context} />}</ResidueContext.Consumer>
);

export default ContactMap;
export { ContactMap };
