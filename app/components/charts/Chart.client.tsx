import type { FC } from 'react';
import type { Props } from 'react-apexcharts';
import ReactApexChart from 'react-apexcharts';

export const Chart: FC<Props> = (props) => <ReactApexChart {...props} />;
