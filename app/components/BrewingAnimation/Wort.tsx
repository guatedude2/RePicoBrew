import type { FC } from 'react';

export interface WortProps {
  wortColor: string;
}

export const Wort: FC<WortProps> = ({ wortColor }) => (
  <g className="wort" transform="matrix(1,0,0,1,0,373)">
    <g transform="matrix(1,0,0,1.96774,-4,-96.0968)">
      <ellipse cx="394" cy="105.5" rx="215" ry="15.5" style={{ fill: wortColor, transition: '5s fill' }} />
    </g>
    <g transform="matrix(1,0,0,1,-6,2)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ animationDelay: '0ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,31,-7)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0.5, animationDelay: '250ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,-45,0)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0.25, animationDelay: '0ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,70,0)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0, animationDelay: '100ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,100,-6)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0.25, animationDelay: '0ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,-20,-13)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0.5, animationDelay: '300ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,-85,-7)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0.5, animationDelay: '350ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,141,-7)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0, animationDelay: '50ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,191,-5)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0.5, animationDelay: '200ms' }} />
    </g>
    <g transform="matrix(1,0,0,1,53,-17)">
      <circle className="wort-bubbles" cx="350" cy="97" r="6" style={{ opacity: 0.25, animationDelay: '0ms' }} />
    </g>
  </g>
);
