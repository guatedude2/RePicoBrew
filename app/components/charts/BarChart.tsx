import React from 'react';
import { ClientOnly } from 'remix-utils';
import { Chart } from './Chart.client';

type ChartProps = {
  // using `interface` is also ok
  [x: string]: any;
};
type ChartState = {
  chartData: any[];
  chartOptions: any;
};

class ColumnChart extends React.Component<ChartProps, ChartState> {
  constructor(props: { chartData: any[]; chartOptions: any }) {
    super(props);
    this.state = {
      chartData: [],
      chartOptions: {},
    };
  }

  componentDidMount() {
    this.setState({
      chartData: this.props.chartData,
      chartOptions: this.props.chartOptions,
    });
  }

  render() {
    return (
      <ClientOnly>
        {() => (
          <Chart
            options={this.state.chartOptions}
            series={this.state.chartData}
            type="bar"
            width="100%"
            height="100%"
          />
        )}
      </ClientOnly>
    );
  }
}

export default ColumnChart;
