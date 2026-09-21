// Distinguishes a dragged *group* from a dragged *lane* on the board's
// native HTML5 drag-and-drop, so a group card dropped over a lane row (or a
// lane dropped over a group's own drag handle) is correctly ignored rather
// than misinterpreted as the other kind of drop.
export const GROUP_DRAG_MIME = 'application/x-purjo-group'
