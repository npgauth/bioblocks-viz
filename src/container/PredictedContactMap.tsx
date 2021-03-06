import * as React from 'react';
import { Provider } from 'react-redux';

import { ContactMap, generateChartDataEntry, IContactMapChartData } from '~bioblocks-viz~/component';
import {
  BIOBLOCKS_CSS_STYLE,
  BioblocksWidgetConfig,
  CONFIGURATION_COMPONENT_TYPE,
  CouplingContainer,
  IContactMapData,
  ICouplingScoreFilter,
  SECONDARY_STRUCTURE,
} from '~bioblocks-viz~/data';
import { generateCouplingScoreHoverText } from '~bioblocks-viz~/helper';
import { BBStore } from '~bioblocks-viz~/reducer';

export interface IPredictedContactMapProps {
  agreementColor: string;
  allColor: string;
  data: IContactMapData;
  filters: ICouplingScoreFilter[];
  height: number | string;
  isDataLoading: boolean;
  style?: BIOBLOCKS_CSS_STYLE;
  width: number | string;
}

export const initialPredictedContactMapState = {
  linearDistFilter: 5,
  minimumProbability: 0.9,
  minimumScore: 0,
  numPredictionsToShow: -1,
  pointsToPlot: [] as IContactMapChartData[],
  rankFilter: [1, 100],
};

export type PredictedContactMapState = typeof initialPredictedContactMapState;

export class PredictedContactMap extends React.Component<IPredictedContactMapProps, PredictedContactMapState> {
  public static defaultProps = {
    agreementColor: '#ff0000',
    allColor: '#000000',
    data: {
      couplingScores: new CouplingContainer(),
      secondaryStructures: new Array<SECONDARY_STRUCTURE>(),
    },
    filters: [],
    height: '100%',
    isDataLoading: false,
    width: '100%',
  };

  public readonly state: PredictedContactMapState = initialPredictedContactMapState;

  constructor(props: IPredictedContactMapProps) {
    super(props);
  }

  public componentDidMount() {
    this.setupData(true);
  }

  public componentDidUpdate(prevProps: IPredictedContactMapProps, prevState: PredictedContactMapState) {
    const { data } = this.props;
    const { linearDistFilter, minimumProbability, minimumScore, numPredictionsToShow, rankFilter } = this.state;

    const isRecomputeNeeded =
      data.couplingScores !== prevProps.data.couplingScores ||
      linearDistFilter !== prevState.linearDistFilter ||
      minimumProbability !== prevState.minimumProbability ||
      minimumScore !== prevState.minimumScore ||
      numPredictionsToShow !== prevState.numPredictionsToShow ||
      rankFilter !== prevState.rankFilter;
    if (isRecomputeNeeded) {
      this.setupData(data.couplingScores !== prevProps.data.couplingScores);
    }
  }

  public render() {
    const { data, style, ...passThroughProps } = this.props;
    const { pointsToPlot } = this.state;

    return (
      <Provider store={BBStore}>
        <div className="PredictedContactMapComponent" style={style}>
          <ContactMap
            configurations={this.getConfigs()}
            data={{
              couplingScores: data.couplingScores,
              pdbData: data.pdbData,
              secondaryStructures: data.secondaryStructures,
            }}
            formattedPoints={pointsToPlot}
            {...passThroughProps}
          />
        </div>
      </Provider>
    );
  }

  public onLinearDistFilterChange = () => (value: number) => {
    this.setState({
      linearDistFilter: value,
    });
  };

  public onMinimumProbabilityChange = () => (value: number) => {
    this.setState({
      minimumProbability: value,
    });
  };

  public onNumPredictionsToShowChange = () => (value: number) => {
    this.setState({
      numPredictionsToShow: value,
    });
  };

  protected getConfigs = (): BioblocksWidgetConfig[] => {
    const { linearDistFilter, minimumProbability, numPredictionsToShow } = this.state;
    const { chainLength } = this.props.data.couplingScores;

    return [
      {
        marks: {
          [Math.floor(chainLength / 2)]: 'L/2',
          [Math.floor(chainLength / 4)]: 'L/4',
          0: '0',
          [chainLength]: 'L',
          [chainLength * 2]: '2L',
          [chainLength * 3]: '3L',
        },
        name: '# Couplings to Display',
        onChange: this.onNumPredictionsToShowChange(),
        type: CONFIGURATION_COMPONENT_TYPE.SLIDER,
        values: {
          current: numPredictionsToShow,
          defaultValue: Math.floor(chainLength / 2),
          max: chainLength * 3,
          min: 0,
        },
      },
      {
        name: 'Linear Distance Filter (|i - j|)',
        onChange: this.onLinearDistFilterChange(),
        type: CONFIGURATION_COMPONENT_TYPE.SLIDER,
        values: {
          current: linearDistFilter,
          defaultValue: initialPredictedContactMapState.linearDistFilter,
          max: 10,
          min: 1,
        },
      },
      {
        name: 'Minimum Probability',
        onChange: this.onMinimumProbabilityChange(),
        step: 0.01,
        type: CONFIGURATION_COMPONENT_TYPE.SLIDER,
        values: {
          current: minimumProbability,
          defaultValue: initialPredictedContactMapState.minimumProbability,
          max: 1.0,
          min: 0.0,
        },
      },
    ];
  };

  protected getPredictedFilters = () => {
    const { linearDistFilter, minimumProbability, minimumScore } = this.state;

    return new Array<ICouplingScoreFilter>(
      {
        filterFn: score => (score.probability ? score.probability >= minimumProbability : true),
      },
      {
        filterFn: score => (score.score ? score.score >= minimumScore : true),
      },
      {
        filterFn: score => Math.abs(score.i - score.j) >= linearDistFilter,
      },
    );
  };

  /**
   * Setups up the prediction values for the data.
   *
   * @param isNewData Is this an entirely new dataset?
   */
  protected setupData(isNewData: boolean) {
    const { agreementColor, data, allColor } = this.props;
    const { linearDistFilter, numPredictionsToShow } = this.state;
    const { couplingScores } = data;
    const { chainLength } = couplingScores;

    const newPoints = new Array<IContactMapChartData>();

    if (couplingScores.isDerivedFromCouplingScores) {
      const allPredictions = couplingScores.getPredictedContacts(
        numPredictionsToShow,
        linearDistFilter,
        this.getPredictedFilters(),
      );
      const correctPredictionPercent = (
        (allPredictions.correct.length / allPredictions.predicted.length) *
        100
      ).toFixed(1);
      newPoints.push(
        generateChartDataEntry(
          'text',
          allColor,
          'Experimental Contact',
          `(N=${numPredictionsToShow}, L=${chainLength})`,
          4,
          allPredictions.predicted,
          {
            text: allPredictions.predicted.map(generateCouplingScoreHoverText),
          },
        ),
        generateChartDataEntry(
          'text',
          agreementColor,
          'Inferred Contact Agrees with Experimental Contact',
          `(N=${allPredictions.correct.length}, ${correctPredictionPercent}%)`,
          6,
          allPredictions.correct,
          {
            text: allPredictions.correct.map(generateCouplingScoreHoverText),
          },
        ),
      );
    }

    this.setState({
      numPredictionsToShow: isNewData ? Math.floor(chainLength / 2) : numPredictionsToShow,
      pointsToPlot: newPoints,
    });
  }
}
