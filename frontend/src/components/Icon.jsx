// Renderiza um conjunto de <path> a partir de uma lista de "d" — mesmo
// padrão usado no dashboard PBX de referência.
export default function Icon({ paths, size = 16, color = 'currentColor', strokeWidth = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export const ICONS = {
  network: ['M2 3h20v8H2z', 'M2 13h20v8H2z', 'M6 7h.01', 'M6 17h.01'],
  check: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01 9 11.01'],
  offline: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M15 9l-6 6', 'M9 9l6 6'],
  warningTriangle: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z', 'M12 9v4', 'M12 17h.01'],
  server: ['M2 3h20v8H2z', 'M2 13h20v8H2z', 'M6 7h.01', 'M6 17h.01'],
  camera: ['M23 7l-7 5 7 5V7z', 'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z'],
  nvr: ['M4 4h16v12H4z', 'M2 20h20', 'M9 8h6', 'M9 11h3'],
  doorbell: ['M7 3h10v18H7z', 'M12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', 'M10 15h4'],
  intercom: ['M5 8a7 7 0 0 1 14 0', 'M3 11h18v9H3z', 'M9 15h6'],
  wifi: ['M5 12.55a11 11 0 0 1 14.08 0', 'M1.42 9a16 16 0 0 1 21.16 0', 'M8.53 16.11a6 6 0 0 1 6.95 0', 'M12 20h.01'],
  switchIcon: ['M4 6h16', 'M4 12h16', 'M4 18h16', 'M8 4v4', 'M16 10v4', 'M8 16v4'],
  helpCircle: ['M9 9a3 3 0 1 1 4 2.83A2 2 0 0 0 12 14', 'M12 17h.01', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M12 16v-4', 'M12 8h.01'],
  moon: ['M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'],
  sun: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  refresh: ['M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16', 'M16 16h5v5'],
  settings: ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0'],
  search: ['M3 11a8 8 0 1 0 16 0 8 8 0 1 0-16 0', 'M21 21l-4.3-4.3'],
  clock: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'M12 7v5l4 2'],
  upload: ['M12 3v12', 'M7 8l5-5 5 5', 'M5 21h14'],
  download: ['M12 3v12', 'M17 10l-5 5-5-5', 'M5 21h14'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 12h10'],
  play: ['M5 3l14 9-14 9V3z'],
  starFilled: ['M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.4 19.4 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a19.5 19.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24', 'M1 1l22 22'],
  copy: ['M9 9h11v11H9z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  externalLink: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
  command: ['M9 3H5a2 2 0 0 0-2 2v4', 'M15 3h4a2 2 0 0 1 2 2v4', 'M21 15v4a2 2 0 0 1-2 2h-4', 'M9 21H5a2 2 0 0 1-2-2v-4'],
  wrench: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  qrCode: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M20 14h1v1h-1z', 'M14 20h1v1h-1z', 'M17 17h4v4h-4z'],
  tv: ['M2 4h20v14H2z', 'M8 22h8', 'M12 18v4'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  bellOff: ['M13.73 21a2 2 0 0 1-3.46 0', 'M18.63 13A17.89 17.89 0 0 1 18 8a6 6 0 0 0-9.33-5', 'M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14', 'M1 1l22 22'],
  map: ['M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z', 'M8 2v16', 'M16 6v16'],
  expand: ['M8 3H5a2 2 0 0 0-2 2v3', 'M16 3h3a2 2 0 0 1 2 2v3', 'M21 16v3a2 2 0 0 1-2 2h-3', 'M3 16v3a2 2 0 0 0 2 2h3'],
};

export const TYPE_META = {
  nvr: { label: 'NVR', icon: ICONS.nvr },
  camera: { label: 'Câmera', icon: ICONS.camera },
  porteiro: { label: 'Porteiro', icon: ICONS.doorbell },
  interfone: { label: 'Interfone', icon: ICONS.intercom },
  switch: { label: 'Switch', icon: ICONS.switchIcon },
  ap: { label: 'AP / Wi-Fi', icon: ICONS.wifi },
  servidor: { label: 'Servidor', icon: ICONS.server },
  outro: { label: 'Outro', icon: ICONS.helpCircle },
};
