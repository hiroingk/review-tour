export type ScrollPosition = {
  scrollLeft: number;
  scrollTop: number;
};

export function resetScrollPosition(target: ScrollPosition | null | undefined) {
  if (!target) return;

  target.scrollLeft = 0;
  target.scrollTop = 0;
}
