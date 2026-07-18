/**
 * Tab order for the mobile live fixture screen — shared between the card
 * (tab buttons + sliding pane track) and the deck (horizontal swipe-paging
 * gesture), and kept in its own module so component files stay
 * fast-refreshable.
 */
export const FIXTURE_CARD_TABS = [
  { id: 'match', label: 'Match' },
  { id: 'lineups', label: 'Lineups' },
  { id: 'stats', label: 'Stats' },
  { id: 'odds', label: 'Odds' },
  { id: 'table', label: 'Table' },
];
