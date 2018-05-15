import * as Plotly from 'plotly.js';
import * as React from 'react';
import { Checkbox } from 'semantic-ui-react';

import ResidueContext, { initialResidueContext, IResidueSelection } from '../context/ResidueContext';
import { CONTACT_VIEW_TYPE, IContactMapData, ICouplingScore, RESIDUE_TYPE } from '../data/chell-data';
import { withDefaultProps } from '../helper/ReactHelper';
import ChellSlider from './ChellSlider';
import PointCloudChart from './PointCloudChart';
import ScatterChart from './ScatterChart';

export type CONTACT_MAP_CB_RESULT_TYPE = ICouplingScore;
export type ContactMapCallback = (coupling: CONTACT_MAP_CB_RESULT_TYPE) => void;

export const defaultContactMapProps = {
  correctColor: '#ff0000',
  data: {
    couplingScores: [],
  } as IContactMapData,
  enableSliders: false,
  height: 400,
  highlightColor: '#ff0000',
  incorrectColor: '#000000',
  ...initialResidueContext,
  observedColor: '#0000ff',
  onClick: undefined as ContactMapCallback | undefined,
  onMouseEnter: undefined as ContactMapCallback | undefined,
  padding: 0,
  selectedData: undefined as number | undefined,
  width: 400,
};

export const initialContactMapState = {
  contactViewType: CONTACT_VIEW_TYPE.BOTH,
  correctPredictedContacts: [] as ICouplingScore[],
  highlightedPoints: [] as number[],
  incorrectPredictedContacts: [] as ICouplingScore[],
  isUsingScatterGL: true,
  nodeSize: 3,
  observedContacts: [] as ICouplingScore[],
  probabilityFilter: 0.99,
};

export type ContactMapProps = {} & typeof defaultContactMapProps;
export type ContactMapState = Readonly<typeof initialContactMapState>;

export class ContactMapClass extends React.Component<ContactMapProps, ContactMapState> {
  public readonly state: ContactMapState = initialContactMapState;

  constructor(props: ContactMapProps) {
    super(props);
  }

  public componentDidMount() {
    this.setupData(this.props.data, this.state.contactViewType);
  }

  public componentDidUpdate(prevProps: ContactMapProps, prevState: ContactMapState) {
    const { data, lockedResiduePairs } = this.props;
    const { contactViewType } = this.state;

    const isFreshDataView =
      data !== prevProps.data ||
      this.state.probabilityFilter !== prevState.probabilityFilter ||
      contactViewType !== prevState.contactViewType;
    if (isFreshDataView) {
      this.setupData(data, contactViewType);
    }

    if (lockedResiduePairs && prevProps.lockedResiduePairs !== lockedResiduePairs) {
      this.setupHighlightedResidues(lockedResiduePairs);
    }
  }

  public render() {
    const {
      correctColor,
      incorrectColor,
      height,
      // highlightColor,
      observedColor,
      padding,
      width,
      addLockedResiduePair,
      addHoveredResidues,
      candidateResidues,
      hoveredResidues,
      // lockedResiduePairs,
    } = this.props;

    const {
      correctPredictedContacts,
      incorrectPredictedContacts,
      isUsingScatterGL,
      nodeSize,
      observedContacts,
    } = this.state;

    const sliderStyle = { width };

    const inputData = [
      {
        color: correctColor,
        points: correctPredictedContacts,
      },
      {
        color: incorrectColor,
        points: incorrectPredictedContacts,
      },
      {
        color: observedColor,
        points: observedContacts,
      },
    ];

    return (
      <div id="ContactMapComponent" style={{ padding }}>
        {isUsingScatterGL ? (
          <ScatterChart
            candidateResidues={candidateResidues}
            height={height}
            hoveredResidues={hoveredResidues}
            data={inputData}
            nodeSize={nodeSize}
            onHoverCallback={this.onMouseEnter(addHoveredResidues)}
            onClickCallback={this.onMouseClick(addLockedResiduePair)}
            onSelectedCallback={this.onMouseSelect()}
            width={width}
          />
        ) : (
          <PointCloudChart
            candidateResidues={candidateResidues}
            height={height}
            hoveredResidues={hoveredResidues}
            data={inputData}
            nodeSize={nodeSize}
            onHoverCallback={this.onMouseEnter(addHoveredResidues)}
            onClickCallback={this.onMouseClick(addLockedResiduePair)}
            onSelectedCallback={this.onMouseSelect()}
            width={width}
          />
        )}
        {this.props.enableSliders && this.renderSliders(sliderStyle)}
        <Checkbox
          defaultChecked={false}
          label={isUsingScatterGL ? 'ScatterGL' : 'Point Cloud'}
          toggle={true}
          onChange={this.onRendererChange()}
        />
        <ChellSlider
          defaultValue={1}
          hideLabelValue={true}
          label={'What to show?'}
          max={2}
          min={0}
          onChange={this.onContactViewChange()}
          sliderProps={{
            marks: { 0: 'Observed', 1: 'Both', 2: 'Predicted' },
          }}
          style={sliderStyle}
        />
      </div>
    );
  }

  protected renderSliders(sliderStyle: React.CSSProperties[] | React.CSSProperties) {
    return (
      <div>
        <ChellSlider
          max={100}
          min={0}
          label={'Probability'}
          defaultValue={99}
          onChange={this.onProbabilityChange()}
          style={sliderStyle}
        />
        <ChellSlider
          max={5}
          min={1}
          label={'Node Size'}
          defaultValue={this.state.nodeSize}
          onChange={this.onNodeSizeChange()}
          style={sliderStyle}
        />
      </div>
    );
  }

  protected setupData(data: IContactMapData, contactViewType: CONTACT_VIEW_TYPE) {
    const showObserved = contactViewType === CONTACT_VIEW_TYPE.BOTH || contactViewType === CONTACT_VIEW_TYPE.OBSERVED;
    const showPredicted = contactViewType === CONTACT_VIEW_TYPE.BOTH || contactViewType === CONTACT_VIEW_TYPE.PREDICTED;

    const maxContactsToConsider = 100;
    const maxAng = 5;
    const maxResidueDist = 1;

    const observedContacts: ICouplingScore[] = [];
    const correctPredictedContacts: ICouplingScore[] = [];
    const incorrectPredictedContacts: ICouplingScore[] = [];

    for (const contact of data.couplingScores.slice(0, maxContactsToConsider)) {
      if (Math.abs(contact.i - contact.j) > maxResidueDist) {
        if (contact.dist < maxAng && showObserved) {
          observedContacts.push(contact);
        } else if (contact.dist >= maxAng && showPredicted) {
          incorrectPredictedContacts.push(contact);
        }
      }
    }

    this.setState({
      correctPredictedContacts,
      incorrectPredictedContacts,
      observedContacts,
    });
  }

  protected setupHighlightedResidues(pairs: IResidueSelection) {
    const pairKeys = Object.keys(pairs);
    const highlightedPoints: number[] = [];
    for (const key of pairKeys) {
      for (const residue of pairs[key]) {
        highlightedPoints.push(residue);
      }
    }

    this.setState({
      highlightedPoints,
    });
  }

  protected onProbabilityChange = () => (value: number) => {
    this.setState({
      probabilityFilter: value / 100,
    });
  };

  protected onNodeSizeChange = () => (value: number) => {
    this.setState({
      nodeSize: value,
    });
  };

  protected onContactViewChange = () => (value: number) => {
    this.setState({
      contactViewType: value,
    });
  };

  protected onRendererChange = () => (value: any) => {
    this.setState({
      isUsingScatterGL: !this.state.isUsingScatterGL,
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
