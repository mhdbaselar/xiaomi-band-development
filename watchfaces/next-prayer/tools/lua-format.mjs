// Type-5 file resources, independently implemented from the public EasyFace
// Lua sample binaries. No proprietary compiler or sample artwork is embedded.
import assert from 'node:assert/strict'

const align4 = n => (n + 3) & ~3

export function packLuaFace({ id, name, files, entry = 'lua/main.lua', preview }) {
  assert.match(id, /^\d{9}$/)
  assert.ok(Buffer.byteLength(name) < 60)
  assert.ok(files.length > 0 && files.length < 256)
  const entryIndex = files.findIndex(file => file.name === entry)
  assert.ok(entryIndex >= 0, 'Missing Lua entry point')
  assert.equal(new Set(files.map(file => file.name)).size, files.length)
  const tableEnd = 0x100 + 16 * (1 + files.length)
  // Samples reserve 16 zero bytes after the 16-byte element property.
  let cursor = tableEnd + 32
  const records = files.map(file => {
    assert.match(file.name, /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/)
    assert.ok(!file.name.split('/').some(part => part === '.' || part === '..'))
    const filename = Buffer.from(file.name)
    const data = Buffer.from(file.data)
    assert.ok(filename.length < 256 && data.length < 0x1000000)
    const block = Buffer.alloc(20 + filename.length + data.length)
    block.writeUIntLE(data.length, 0, 3)
    block[3] = filename.length
    filename.copy(block, 20)
    data.copy(block, 20 + filename.length)
    const offset = cursor
    cursor += align4(block.length)
    return { block, offset }
  })
  const previewOffset = cursor
  const out = Buffer.alloc(align4(previewOffset + preview.length))
  out.set([0x5a, 0xa5, 0x34, 0x12])
  out.writeUInt32LE(0x800, 0x10)
  out.writeUInt16LE(1, 0x1c)
  // Lua examples use styleCount=0; a single active face, no AOD record.
  out.writeUInt32LE(previewOffset, 0x20)
  out.write(id, 0x28)
  out.write(name, 0x68)
  out.writeUInt32LE(previewOffset, 0xac)
  for (let type = 0; type <= 9; type++) {
    const offset = 0xa8 + 8 + type * 8
    out.writeUInt32LE(type === 0 ? 1 : type === 5 ? files.length : 0, offset)
    out.writeUInt32LE(type === 0 ? 0x100 : type <= 5 ? 0x110 : tableEnd, offset + 4)
  }
  const definition = (position, index, type, offset, length) => {
    out.writeUInt16LE(index, position)
    out[position + 3] = type
    out.writeUInt32LE(offset, position + 8)
    out.writeUInt32LE(length, position + 12)
  }
  definition(0x100, 0, 0, tableEnd, 16)
  out.writeUIntLE(entryIndex, tableEnd, 3)
  out[tableEnd + 3] = 5
  records.forEach(({ block, offset }, index) => {
    definition(0x110 + index * 16, index, 5, offset, block.length)
    block.copy(out, offset)
  })
  Buffer.from(preview).copy(out, previewOffset)
  return out
}

export function readLuaFiles(binary) {
  const data = Buffer.from(binary)
  assert.equal(data.subarray(0, 4).toString('hex'), '5aa53412')
  assert.equal(data.readUInt16LE(0x1c), 1)
  const count = data.readUInt32LE(0xd8)
  const table = data.readUInt32LE(0xdc)
  assert.ok(count > 0 && count < 256 && table + count * 16 <= data.length)
  return Array.from({ length: count }, (_, index) => {
    const definition = table + index * 16
    assert.equal(data[definition + 3], 5)
    const offset = data.readUInt32LE(definition + 8)
    const length = data.readUInt32LE(definition + 12)
    assert.ok(length >= 20 && offset + length <= data.length)
    const size = data.readUIntLE(offset, 3)
    const nameSize = data[offset + 3]
    assert.equal(size + nameSize + 20, length)
    return {
      name: data.subarray(offset + 20, offset + 20 + nameSize).toString('utf8'),
      data: data.subarray(offset + 20 + nameSize, offset + length)
    }
  })
}
