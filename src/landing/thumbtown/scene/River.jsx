// River — static water ribbon, meandering down the valley floor.
//
// Emerges from the mid-mountain dip around (955, 720), curves first
// right then left as it descends toward the viewer, and empties into
// the foreground at roughly (870, 1080). The meander keeps it from
// reading as a geometric wedge — it has to feel drawn, not
// extruded.
//
// Banks are rimmed with a thin dark-earth stroke so the water has
// some grounding. Highlight is a single subtle scribble down the
// centerline catching the sunset.

import React from 'react';
import { MOUNTAIN_VIEWBOX } from './MountainRange';

const WATER      = '#536e79';
const WATER_HIGH = '#8aa0a9';
const BANK       = '#3a2a22';

export default function River() {
  // Right bank top to bottom, then left bank bottom to top.
  const path =
    'M 960,722 ' +
    // gently curving right bank — bulges right then sweeps out to the
    // main mountain's foot, so the mouth meets the mountain base
    'C 984,800 1000,870 1005,940 ' +
    'C 1008,1000 1012,1050 1018,1080 ' +
    // foreground mouth — widens to span the gap between foreground
    // slope (left) and main mountain base (right)
    'L 800,1080 ' +
    // left bank back up — curves in so water narrows upstream
    'C 808,1060 822,1030 838,994 ' +
    'C 858,938 872,880 885,822 ' +
    'C 898,776 922,744 948,720 ' +
    'Z';

  const highlight =
    'M 952,740 ' +
    'C 960,800 968,860 965,920 ' +
    'C 960,980 940,1030 918,1070';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${MOUNTAIN_VIEWBOX.width} ${MOUNTAIN_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <path
        d={path}
        fill={WATER}
        stroke={BANK}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={highlight}
        fill="none"
        stroke={WATER_HIGH}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
