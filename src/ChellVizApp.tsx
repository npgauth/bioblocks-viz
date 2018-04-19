import * as React from 'react';
import { Grid, GridRow } from 'semantic-ui-react';

import { VIZ_TYPE } from 'chell';
import { VizPanelContainer } from './container/VizPanelContainer';

export class ChellVizApp extends React.Component<any, any> {
  public render() {
    return (
      <div id="ChellVizApp">
        <Grid centered={true} divided={'vertically'}>
          {/*
          <GridRow>
            <VizPanelContainer
              dataDirs={['1', '_100k', '_1m'].map(dir => `assets/contact_map/example${dir}`)}
              supportedVisualizations={[
                VIZ_TYPE.CONTACT_MAP,
                VIZ_TYPE.CONTACT_MAP_DYGRAPH,
                VIZ_TYPE.CONTACT_MAP_HIGH_CHART,
                VIZ_TYPE.CONTACT_MAP_PLOTLY,
                VIZ_TYPE.CONTACT_MAP_RECHART,
              ]}
              initialVisualizations={[VIZ_TYPE.CONTACT_MAP_RECHART]}
              numPanels={1}
            />
          </GridRow>
            */}
          <GridRow>
            <VizPanelContainer
              dataDirs={['1', '2', '3'].map(dir => `assets/contact_map/example${dir}`)}
              supportedVisualizations={[VIZ_TYPE.CONTACT_MAP, VIZ_TYPE.NGL]}
              initialVisualizations={[VIZ_TYPE.CONTACT_MAP, VIZ_TYPE.NGL]}
              numPanels={2}
            />
          </GridRow>
          <GridRow>
            <VizPanelContainer
              dataDirs={['centroids', 'centroids_subset', 'ngl', 'spring2/full'].map(dir => `assets/${dir}`)}
              initialVisualizations={[VIZ_TYPE['T-SNE'], VIZ_TYPE.SPRING]}
              supportedVisualizations={[VIZ_TYPE['T-SNE'], VIZ_TYPE.SPRING]}
              numPanels={2}
            />
          </GridRow>
        </Grid>
      </div>
    );
  }
}
