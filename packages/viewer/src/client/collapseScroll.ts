export type CollapseScrollSnapshot = {
  currentScrollTop: number;
  fileTop: number;
  rootTop: number;
};

export function getCollapsedFileScrollTop({
  currentScrollTop,
  fileTop,
  rootTop,
}: CollapseScrollSnapshot) {
  if (fileTop >= rootTop - 0.5) return null;

  return Math.max(0, currentScrollTop + fileTop - rootTop);
}
