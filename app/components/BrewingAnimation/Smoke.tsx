import type { FC } from 'react';

export interface SmokeProps {
  opacity: number;
}

export const Smoke: FC<SmokeProps> = ({ opacity }) => (
  <g className="smoke" style={{ opacity, transition: '3s opacity' }}>
    <g className="smoke-cloud" style={{ animationDelay: '500ms' }}>
      <g transform="matrix(0.992545,0.121882,-0.121882,0.992545,9.19024,375.772)">
        <path
          d="M316.405,71.834L239.316,158.367L286.301,242.523L359.209,283.664L397.589,181.781L367.539,92.424L316.405,71.834Z"
          style={{ fill: 'white', fillOpacity: 0.24 }}
        />
      </g>
    </g>
    <g className="smoke-cloud" style={{ animationDelay: '600ms' }}>
      <g transform="matrix(0.812895,0.58241,-0.58241,0.812895,209.672,261.306)">
        <path
          d="M316.405,71.834L239.316,158.367L286.301,242.523L359.209,283.664L397.589,181.781L367.539,92.424L316.405,71.834Z"
          style={{ fill: 'white', fillOpacity: 0.24 }}
        />
      </g>
    </g>
    <g className="smoke-cloud" style={{ animationDelay: '150ms' }}>
      <g transform="matrix(0.90507,-0.425264,0.425264,0.90507,-61.9672,597.126)">
        <path
          d="M316.405,71.834L239.316,158.367L286.301,242.523L359.209,283.664L397.589,181.781L367.539,92.424L316.405,71.834Z"
          style={{ fill: 'white', fillOpacity: 0.24 }}
        />
      </g>
    </g>
    <g className="smoke-cloud" style={{ animationDelay: '200ms' }}>
      <g transform="matrix(0.0705405,-0.997509,0.997509,0.0705405,234.545,928.652)">
        <path
          d="M316.405,71.834L239.316,158.367L286.301,242.523L359.209,283.664L397.589,181.781L367.539,92.424L316.405,71.834Z"
          style={{ fill: 'white', fillOpacity: 0.24 }}
        />
      </g>
    </g>
    <g className="smoke-cloud" style={{ animationDelay: '600ms' }}>
      <g transform="matrix(-0.836215,-0.548401,0.548401,-0.836215,631.017,934.688)">
        <path
          d="M316.405,71.834L239.316,158.367L286.301,242.523L359.209,283.664L397.589,181.781L367.539,92.424L316.405,71.834Z"
          style={{ fill: 'white', fillOpacity: 0.24 }}
        />
      </g>
    </g>
    <g className="smoke-cloud" style={{ animationDelay: '500ms' }}>
      <g transform="matrix(-0.886767,0.462216,-0.462216,-0.886767,689.861,613.179)">
        <path
          d="M316.405,71.834L239.316,158.367L286.301,242.523L359.209,283.664L397.589,181.781L367.539,92.424L316.405,71.834Z"
          style={{ fill: 'white', fillOpacity: 0.24 }}
        />
      </g>
    </g>
    <g className="smoke-cloud" style={{ animationDelay: '200ms' }}>
      <g transform="matrix(-0.0293555,0.999569,-0.999569,-0.0293555,625.53,309.021)">
        <path
          d="M316.405,71.834L239.316,158.367L286.301,242.523L359.209,283.664L397.589,181.781L367.539,92.424L316.405,71.834Z"
          style={{ fill: 'white', fillOpacity: 0.24 }}
        />
      </g>
    </g>
  </g>
);
