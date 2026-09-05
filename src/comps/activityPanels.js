import UnoPanel from './Uno/UnoPanel';
import WhiteboardPanel from './Whiteboard/WhiteboardPanel';

// The component each activity opens, kept apart from the registry in
// activities.js on purpose: that file is imported by the public features page,
// which has no business shipping a UNO engine and a drawing canvas to someone
// who is only reading about them. Splitting the metadata from the components is
// what keeps that page's bundle small.
//
// So a new activity is two lines, not one: its entry in ACTIVITIES, and its
// panel here. ChatWindow reads both; nothing else needs this file.
export const ACTIVITY_PANELS = {
  uno: UnoPanel,
  whiteboard: WhiteboardPanel,
};

export function activityPanel(id) {
  return ACTIVITY_PANELS[id] ?? null;
}
