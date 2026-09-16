import type { BoxProps } from '@chakra-ui/react';
import { Box } from '@chakra-ui/react';
import { useMemo, type FC } from 'react';
import { BeerBottles } from './BeerBottles';
import { Chiller } from './Chiller';
import { Drops } from './Drops';
import { Fermenter } from './Fermenter';
import { Fire } from './Fire';
import { GrainBag } from './GrainBag';
import { Hops } from './Hops';
import { Pot } from './Pot';
import { Smoke } from './Smoke';
import { Wort } from './Wort';

export enum Phase {
  PREPARING = 0,
  HEATING = 1,
  MASHING = 2,
  BOILING = 3,
  BITTERING = 4,
  CHILLING = 5,
  SETTING = 6,
  FERMENTING = 7,
  CARBONATING = 8,
}

const HEATING_PHASES: Phase[] = [Phase.HEATING, Phase.MASHING, Phase.BOILING, Phase.BITTERING];

export interface BrewingAnimationProps extends BoxProps {
  phase: Phase;
  temperature: number;
}

export const BrewingAnimation: FC<BrewingAnimationProps> = ({ phase, temperature, ...props }) => {
  const wortColors = useMemo(() => {
    switch (phase) {
      case Phase.PREPARING:
      case Phase.HEATING:
        return { wort: '#398ADF', bubbles: temperature > 150 ? '#6CA4E0' : 'transparent' };
      default:
        return { wort: '#DBA929', bubbles: temperature > 150 ? '#FFD509' : 'transparent' };
    }
  }, [phase, temperature]);

  return (
    <Box
      as="svg"
      className="eZ1mJQt4wBR1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 798 1000"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      sx={{
        '@keyframes boilingWort': {
          '0%': {
            r: '6',
            transform: 'translateY(10px)',
            opacity: 1,
          },
          '80%': {
            r: '14',
            opacity: 0,
            transform: 'translateY(0)',
            animationTimingFunction: 'step-end',
          },
          '100%': {
            r: '6',
            opacity: 1,
            transform: 'translateY(15px)',
          },
        },
        '@keyframes drops': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(120px)', opacity: 0 },
        },
        '@keyframes soakOut': {
          '0%': { transform: 'translateY(400px)' },
          '100%': { transform: 'translateY(-500px)' },
        },
        '@keyframes hopsDrop': {
          '0%': { transform: 'translateY(-450px)' },
          '30%, 100%': { transform: 'translateY(470px)' },
          '70%': { transform: 'translateY(470px)' },
        },
        '@keyframes flaming': {
          '0%': { transform: 'scale(1, 1)' },
          '50%': { transform: 'scale(0.99, 0.99)' },
          '100%': { transform: 'scale(1, 1)' },
        },
        '@keyframes smokeTrail': {
          '0%': { transform: 'translateY(0) scale(1, 1)', opacity: 1 },
          '100%': { transform: 'translateY(-500px) scale(1.2, 1.2)', opacity: 0 },
        },
        '@keyframes fizz': {
          '0%': { transform: 'translateY(0)', opacity: 0 },
          '90%': { transform: 'translateY(-90px)', opacity: 1 },
          '100%': { transform: 'translateY(-100px)', opacity: 0 },
        },
        '& .wort-bubbles': {
          animation: 'boilingWort 500ms ease-in infinite normal forwards',
          fill: wortColors.bubbles,
          transition: '5s fill',
        },
        '& .smoke-cloud': {
          filter: 'blur(20px)',
          animation: 'smokeTrail 1s linear infinite normal forwards',
          transformOrigin: 'center center',
        },
        '& .flames': {
          filter: 'blur(5px)',
          '& > g:first-child > g': {
            animation: 'flaming 100ms infinite',
          },
          '& > g > g': {
            animation: 'flaming 200ms infinite',
          },
        },
      }}
      {...props}
    >
      <g
        className="fermenter"
        style={{
          transform: phase === Phase.FERMENTING ? 'translateX(0)' : 'translateX(800px)',
          transition: '800ms transform',
        }}
      >
        <Fermenter />
      </g>
      <g
        className="cooking-pot"
        style={{
          transform: phase !== Phase.FERMENTING && phase !== Phase.CARBONATING ? 'translateX(0)' : 'translateX(-800px)',
          transition: '800ms transform',
        }}
      >
        <g className="pot-back" transform="matrix(1,0,0,1,0,373)">
          <path
            d="M168,86L158,79C158,79 223.877,53 392,53C560.123,53 625,79 625,79L608,88C608,88 520.305,106 394,106C267.695,106 168,86 168,86Z"
            style={{ fill: 'rgb(118,118,118)' }}
          />
        </g>
        <Wort wortColor={wortColors.wort} />
        <GrainBag isSeeping={phase === Phase.MASHING} isSoaked={phase === Phase.BOILING} />
        {phase === Phase.BITTERING ? <Hops /> : null}
        <Chiller isChilling={phase === Phase.CHILLING} isSoaked={phase === Phase.SETTING} />
        {phase === Phase.BOILING || phase === Phase.SETTING ? <Drops /> : null}
        <Smoke opacity={temperature > 150 ? 1 : 0} />
        <Pot temperature={temperature} isCovered={phase === Phase.SETTING || phase === Phase.FERMENTING} />
        {HEATING_PHASES.includes(phase) ? <Fire /> : null}
      </g>
      <g
        className="cooking-pot"
        style={{
          transform: phase === Phase.CARBONATING ? 'translateX(0)' : 'translateX(800px)',
          transition: '800ms transform',
        }}
      >
        <BeerBottles />
      </g>
    </Box>
  );
};
