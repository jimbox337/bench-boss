/** Primary club colours (public team identity colours), used for score-card bars and play markers. */
export const TEAM_COLORS: Record<string, string> = {
  ANA: '#F47A38', BOS: '#FFB81C', BUF: '#003087', CGY: '#C8102E', CAR: '#CE1126', CHI: '#CF0A2C',
  COL: '#6F263D', CBJ: '#002654', DAL: '#006847', DET: '#CE1126', EDM: '#FF4C00', FLA: '#B9975B',
  LAK: '#111111', MIN: '#154734', MTL: '#AF1E2D', NSH: '#FFB81C', NJD: '#CE1126', NYI: '#00539B',
  NYR: '#0038A8', OTT: '#C52032', PHI: '#F74902', PIT: '#FCB514', SJS: '#006D75', SEA: '#68A2B9',
  STL: '#002F87', TBL: '#002868', TOR: '#00205B', UTA: '#69B3E7', VAN: '#00843D', VGK: '#B4975A',
  WSH: '#C8102E', WPG: '#041E42',
};

export const teamColor = (abbrev?: string) => (abbrev && TEAM_COLORS[abbrev]) || '#64748B';
