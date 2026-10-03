export function shuffleQuoteOrder(
  indices: readonly number[],
  excludedFirst?: number,
  random: () => number = Math.random,
): number[] {
  const order = [...indices];
  let shuffleStart = 0;

  if (order.length > 1 && excludedFirst !== undefined) {
    const excludedPosition = order.indexOf(excludedFirst);
    if (excludedPosition >= 0) {
      const allowedPositions = order.map((_, index) => index).filter((index) => index !== excludedPosition);
      const firstPosition = allowedPositions[Math.floor(random() * allowedPositions.length)];
      [order[0], order[firstPosition]] = [order[firstPosition], order[0]];
      shuffleStart = 1;
    }
  }

  for (let index = shuffleStart; index < order.length - 1; index += 1) {
    const swapIndex = index + Math.floor(random() * (order.length - index));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}
