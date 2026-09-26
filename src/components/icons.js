// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, createSvgIcon, reactExports as ReactRuntime } from "../vendor/recovered-runtime.js";
const TagIcon = ({
  label,
  size: C = 16
}) => jsxRuntime.jsx("span", {
  style: {
    display: "inline-flex",
    alignItems: "center",
    border: "1.2px solid currentColor",
    borderRadius: 4,
    padding: "0 6px",
    fontSize: C * 0.7,
    fontWeight: 600,
    marginLeft: 4,
    height: C,
    lineHeight: `${C}px`,
    background: "transparent",
    whiteSpace: "nowrap"
  },
  children: label
});
const CloseIcon = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
}));
const AudioFile = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8zm2 11h-3v3.75c0 1.24-1.01 2.25-2.25 2.25S8.5 17.99 8.5 16.75s1.01-2.25 2.25-2.25c.46 0 .89.14 1.25.38V11h4zm-3-4V3.5L18.5 9z"
}));
const Edit = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"
}));
const ExpandLess = createSvgIcon(jsxRuntime.jsx("path", {
  d: "m12 8-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"
}));
const ExpandMore = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"
}));
const FiberManualRecord = createSvgIcon(jsxRuntime.jsx("circle", {
  cx: "12",
  cy: "12",
  r: "8"
}));
const GraphicEq = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M7 18h2V6H7zm4 4h2V2h-2zm-8-8h2v-4H3zm12 4h2V6h-2zm4-8v4h2v-4z"
}));
const LibraryMusic = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4z"
}));
const Loop = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8m0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4z"
}));
const Mic = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3m5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z"
}));
const NetworkPing = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M12 14.67 3.41 6.09 2 7.5l8.5 8.5H4v2h16v-2h-6.5l5.15-5.15c.26.1.55.15.85.15 1.38 0 2.5-1.12 2.5-2.5S20.88 6 19.5 6 17 7.12 17 8.5c0 .35.07.67.2.97z"
}));
const PlayArrow = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M8 5v14l11-7z"
}));
const ScreenShare = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2zm-7-3.53v-2.19c-2.78 0-4.61.85-6 2.72.56-2.67 2.11-5.33 6-5.87V7l4 3.73z"
}));
const Send = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"
}));
const Settings = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6"
}));
const Stop = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M6 6h12v12H6z"
}));
const SwapHoriz = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M6.99 11 3 15l3.99 4v-3H14v-2H6.99zM21 9l-3.99-4v3H10v2h7.01v3z"
}));
const Tune = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z"
}));
const VolumeUp = createSvgIcon(jsxRuntime.jsx("path", {
  d: "M3 9v6h4l5 5V4L7 9zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77"
}));
const WaveformIcon = ReactRuntime.forwardRef((S, C) => {
  const w = [[2, 12], [6, 12], [8, 18], [11, 6], [14, 18], [17, 6], [20, 12], [22, 12]].map(([R, _]) => `${R},${_}`).join(" ");
  return jsxRuntime.jsx("svg", {
    ref: C,
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...S,
    children: jsxRuntime.jsx("polyline", {
      points: w
    })
  });
});
WaveformIcon.displayName = "WaveformIcon";
const WaveformPlusIcon = ReactRuntime.forwardRef((S, C) => {
  const w = [[2, 12], [6, 12], [8, 18], [11, 6], [14, 18], [17, 6], [20, 12], [22, 12]].map(([R, _]) => `${R},${_}`).join(" ");
  return jsxRuntime.jsxs("svg", {
    ref: C,
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...S,
    children: [jsxRuntime.jsx("polyline", {
      points: w
    }), jsxRuntime.jsxs("g", {
      children: [jsxRuntime.jsx("line", {
        x1: "4",
        y1: "2.5",
        x2: "4",
        y2: "7.5",
        stroke: "currentColor",
        strokeWidth: "2"
      }), jsxRuntime.jsx("line", {
        x1: "1.5",
        y1: "5",
        x2: "6.5",
        y2: "5",
        stroke: "currentColor",
        strokeWidth: "2"
      })]
    })]
  });
});
WaveformPlusIcon.displayName = "WaveformPlusIcon";
const EmbedderIcon = ReactRuntime.forwardRef((S, C) => jsxRuntime.jsxs("svg", {
  ref: C,
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  ...S,
  children: [jsxRuntime.jsx("line", {
    x1: "4",
    y1: "12",
    x2: "8",
    y2: "12",
    strokeWidth: "1.5"
  }), jsxRuntime.jsx("polyline", {
    points: "6.5,10 8,12 6.5,14",
    strokeWidth: "1.5"
  }), jsxRuntime.jsx("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "12",
    y1: "5",
    x2: "13.5",
    y2: "5",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "12",
    y1: "19",
    x2: "13.5",
    y2: "19",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "22",
    y1: "5",
    x2: "22",
    y2: "19",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "20.5",
    y1: "5",
    x2: "22",
    y2: "5",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "20.5",
    y1: "19",
    x2: "22",
    y2: "19",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "14",
    y1: "8",
    x2: "19",
    y2: "8",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "14",
    y1: "11",
    x2: "16.5",
    y2: "11",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "14",
    y1: "14",
    x2: "20",
    y2: "14",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "14",
    y1: "17",
    x2: "17",
    y2: "17",
    strokeWidth: "2"
  })]
}));
EmbedderIcon.displayName = "EmbedderIcon";
const IndexIcon = ReactRuntime.forwardRef((S, C) => jsxRuntime.jsxs("svg", {
  ref: C,
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  ...S,
  children: [jsxRuntime.jsx("line", {
    x1: "2",
    y1: "12",
    x2: "6",
    y2: "12",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "4",
    y1: "10",
    x2: "4",
    y2: "14",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "8",
    y1: "7",
    x2: "8",
    y2: "21",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "8",
    y1: "7",
    x2: "10",
    y2: "7",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "8",
    y1: "21",
    x2: "10",
    y2: "21",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "22",
    y1: "7",
    x2: "22",
    y2: "21",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "20",
    y1: "7",
    x2: "22",
    y2: "7",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "20",
    y1: "21",
    x2: "22",
    y2: "21",
    strokeWidth: "1"
  }), jsxRuntime.jsx("line", {
    x1: "10.5",
    y1: "10",
    x2: "18",
    y2: "10",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "10.5",
    y1: "12.5",
    x2: "15",
    y2: "12.5",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "10.5",
    y1: "15",
    x2: "19",
    y2: "15",
    strokeWidth: "2"
  }), jsxRuntime.jsx("line", {
    x1: "10.5",
    y1: "17.5",
    x2: "16.5",
    y2: "17.5",
    strokeWidth: "2"
  })]
}));
IndexIcon.displayName = "IndexIcon";
export { TagIcon, CloseIcon, Edit, FiberManualRecord, PlayArrow, Settings, Stop, SwapHoriz, AudioFile, LibraryMusic, Loop, Mic, NetworkPing, ScreenShare, Send, ExpandLess, ExpandMore, VolumeUp, GraphicEq, Tune, WaveformIcon, WaveformPlusIcon, EmbedderIcon, IndexIcon };
