export function parseBitMap(bitmap: number) {
  const result = []
  for (let i = 0; i < 32; i++) {
    if (bitmap & (1 << i))
      result.push(i)
  }
  return result
}
