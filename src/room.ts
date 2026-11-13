// Plan coordinates in metres, measured from the upper-left corner of the diagram.
export const ROOM = { width: 2.9, depth: 4.3, name: '병실 A-01', subject: '홍길동' } as const
export const ROOM_SIZE = `${ROOM.width.toFixed(2)} × ${ROOM.depth.toFixed(2)} m`

export const FIXTURES = {
  wardrobe: { x: .04, y: .06, width: 2.82, depth: .44 },
  bed: { x: .9, y: .83, width: 1.94, depth: 1.5, height: .46 },
  entrance: { y: 2.88, depth: 1.3 },
  bathroom: { x: .63, width: .5 },
  cabinet: { x: 2.55, y: 2.69, width: .29, depth: .64 },
  angledFixture: { x: 2.62, y: 3.90, width: .27, depth: .64, angle: 28 },
} as const
